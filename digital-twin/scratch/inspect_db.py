from src.db_client import supabase
res = supabase.table("projects").select("*").limit(1).execute()
if res.data:
    print("Columns:", list(res.data[0].keys()))
else:
    print("No data in projects table")
