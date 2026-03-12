import stripe
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from src.db_client import supabase, get_current_user
from src.config import Config
from src.billing_middleware import get_user_tier_and_usage

logger = logging.getLogger("LumisAPI")

# Initialize Stripe
stripe.api_key = Config.STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET = Config.STRIPE_WEBHOOK_SECRET
FRONTEND_URL = Config.FRONTEND_URL

# You will get these from your Stripe Dashboard -> Product Catalog
PRICES = {
    "pro_monthly": "price_1TABF5HBW6CmGvUgnfBskih3",
    "pro_yearly": "price_1TABGSHBW6CmGvUgoXcokNbQ",
    "team_monthly": "price_1TABL2HBW6CmGvUgIysY09Ym",
    "team_yearly": "price_1TABLMHBW6CmGvUgwMBcGJnz",
}

stripe_router = APIRouter(prefix="/api/billing", tags=["Billing"])

@stripe_router.get("/usage")
async def get_billing_usage(tier_data: dict = Depends(get_user_tier_and_usage)):
    return tier_data

@stripe_router.post("/create-checkout-session")
async def create_checkout_session(payload: dict, current_user=Depends(get_current_user)):
    tier = payload.get("tier")
    interval = payload.get("interval", "monthly")
    
    price_key = f"{tier}_{interval}"
    if price_key not in PRICES:
        raise HTTPException(status_code=400, detail="Invalid tier or interval")

    try:
        # 1. Get or create Stripe Customer ID
        db_sub = supabase.table("user_subscriptions").select("stripe_customer_id").eq("user_id", str(current_user.id)).single().execute()
        customer_id = db_sub.data.get("stripe_customer_id") if db_sub and db_sub.data else None

        if not customer_id:
            customer = stripe.Customer.create(email=current_user.email, metadata={"user_id": str(current_user.id)})
            customer_id = customer.id
            supabase.table("user_subscriptions").upsert({"user_id": str(current_user.id), "stripe_customer_id": customer_id}).execute()

        # 2. Create Stripe Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{'price': PRICES[price_key], 'quantity': 1}],
            mode='subscription',
            success_url=f"{FRONTEND_URL}/settings?billing=success",
            cancel_url=f"{FRONTEND_URL}/pricing?billing=canceled",
            metadata={"user_id": str(current_user.id), "tier": tier}
        )
        return {"url": checkout_session.url}
    except Exception as e:
        logger.error(f"Stripe Checkout Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@stripe_router.post("/create-portal-session")
async def create_portal_session(current_user=Depends(get_current_user)):
    try:
        db_sub = supabase.table("user_subscriptions").select("stripe_customer_id").eq("user_id", str(current_user.id)).single().execute()
        customer_id = db_sub.data.get("stripe_customer_id") if db_sub and db_sub.data else None

        if not customer_id:
            raise HTTPException(status_code=400, detail="No active billing account found.")

        portalSession = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/settings",
        )
        return {"url": portalSession.url}
    except Exception as e:
        logger.error(f"Stripe Portal Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@stripe_router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] in ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']:
        subscription = event['data']['object']
        customer_id = subscription.get('customer')
        status = subscription.get('status')
        price_id = subscription['items']['data'][0]['price']['id']
        
        # Determine tier from price_id
        # Determine tier from price_id
        tier = "free"
        for key, pid in PRICES.items():
            if pid == price_id:
                tier = key.split("_")[0] # 'pro' or 'team'
                break
                
        if status in ['canceled', 'unpaid']:
            tier = 'free' # Graceful downgrade

        # Convert Stripe's UNIX integer timestamp to a Python datetime string
        period_end_ts = subscription.get('current_period_end')
        period_end_date = datetime.utcfromtimestamp(period_end_ts).isoformat() if period_end_ts else None

        try:
            # Update Supabase
            res = supabase.table("user_subscriptions").update({
                "stripe_subscription_id": subscription.get('id'),
                "tier": tier,
                "status": status,
                "current_period_end": period_end_date
            }).eq("stripe_customer_id", customer_id).execute()
            
            logger.info(f"Successfully updated user {customer_id} to tier {tier}")
        except Exception as db_error:
            logger.error(f"Failed to update Supabase: {db_error}")
            
    return {"status": "success"}