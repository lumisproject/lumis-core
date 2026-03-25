import { create } from 'zustand';
import axios from 'axios';
import { API_BASE, supabase } from '../lib/supabase';

export type Priority = 'High' | 'Medium' | 'Low';

export interface Comment {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  timestamp: string;
  isAI?: boolean;
}

export interface Ticket {
  id: string;
  key: string;
  title: string;
  description: string;
  priority: Priority;
  status: string;
  assignee: {
    name: string;
    avatar: string;
  };
  comments: Comment[];
}

export interface StatusColumn {
  id: string;
  title: string;
  color: string;
}

export interface TeamMember {
  accountId: string;
  name: string;
  avatar: string;
}

interface BoardState {
  tickets: Ticket[];
  columns: StatusColumn[];
  teamMembers: TeamMember[];
  loading: boolean;
  error: string | null;
  
  fetchBoard: (projectId: string, tool: 'jira' | 'notion') => Promise<void>;
  updateTicketStatus: (projectId: string, tool: string, ticketId: string, status: string, index?: number) => Promise<void>;
  addTicket: (projectId: string, tool: string, ticketData: any) => Promise<void>;
  addComment: (projectId: string, tool: string, ticketId: string, text: string) => Promise<void>;
  deleteComment: (projectId: string, tool: string, ticketId: string, commentId: string) => Promise<void>;
  fetchTeamMembers: (projectId: string, tool: string) => Promise<void>;
  assignTicket: (projectId: string, tool: string, ticketId: string, accountId: string) => Promise<void>;
  updateTicketDescription: (projectId: string, tool: string, ticketId: string, description: string) => Promise<void>;
  addColumn: (projectId: string, tool: string, columnData: Omit<StatusColumn, 'id'>) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  tickets: [],
  columns: [],
  teamMembers: [],
  loading: false,
  error: null,

  fetchBoard: async (projectId, tool) => {
    set({ loading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await axios.get(`${API_BASE}/api/projects/${projectId}/board?tool=${tool}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      set({ 
        tickets: response.data.tickets, 
        columns: response.data.columns,
        loading: false 
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message, loading: false });
    }
  },

  updateTicketStatus: async (projectId, tool, ticketId, status, index) => {
    const originalTickets = get().tickets;
    
    set((state) => {
      const ticketToMove = state.tickets.find(t => t.id === ticketId);
      if (!ticketToMove) return state;
      
      const otherTickets = state.tickets.filter(t => t.id !== ticketId);
      const updatedTicket = { ...ticketToMove, status };
      return { tickets: [...otherTickets, updatedTicket] };
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(`${API_BASE}/api/projects/${projectId}/board/tickets/${ticketId}?tool=${tool}`, 
        { status, index },
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
    } catch (err: any) {
      console.error("Failed to update ticket status on server", err);
      set({ tickets: originalTickets });
      const errorMessage = err.response?.data?.detail || "Jira workflow prevented this move.";
      alert(`Move Blocked: ${errorMessage}`);
    }
  },

  addTicket: async (projectId, tool, ticketData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_BASE}/api/projects/${projectId}/board/tickets?tool=${tool}`, 
        ticketData,
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      get().fetchBoard(projectId, tool as any);
    } catch (err: any) {
      console.error("Failed to add ticket", err);
      alert("Failed to create issue: " + (err.response?.data?.detail || err.message));
    }
  },

  addComment: async (projectId, tool, ticketId, text) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_BASE}/api/projects/${projectId}/board/tickets/${ticketId}/comments?tool=${tool}`, 
        { text },
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      get().fetchBoard(projectId, tool as any);
    } catch (err: any) {
      console.error("Failed to add comment", err);
      alert("Failed to add comment: " + (err.response?.data?.detail || err.message));
    }
  },

  deleteComment: async (projectId, tool, ticketId, commentId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.delete(`${API_BASE}/api/projects/${projectId}/board/tickets/${ticketId}/comments/${commentId}?tool=${tool}`, 
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      get().fetchBoard(projectId, tool as any);
    } catch (err: any) {
      console.error("Failed to delete comment", err);
      alert("Failed to delete comment: " + (err.response?.data?.detail || err.message));
    }
  },

  fetchTeamMembers: async (projectId, tool) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await axios.get(`${API_BASE}/api/projects/${projectId}/board/users?tool=${tool}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      set({ teamMembers: response.data.users });
    } catch (err: any) {
      console.error("Failed to fetch team members", err);
    }
  },

  assignTicket: async (projectId, tool, ticketId, accountId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.put(`${API_BASE}/api/projects/${projectId}/board/tickets/${ticketId}/assignee?tool=${tool}`, 
        { accountId },
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      // Re-fetch the board to update the assignee avatar in the UI
      get().fetchBoard(projectId, tool as any);
    } catch (err: any) {
      console.error("Failed to assign ticket", err);
      alert("Failed to assign ticket: " + (err.response?.data?.detail || err.message));
    }
  },

  updateTicketDescription: async (projectId, tool, ticketId, description) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.put(`${API_BASE}/api/projects/${projectId}/board/tickets/${ticketId}/description?tool=${tool}`, 
        { description },
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      // Re-fetch to pull the officially formatted description
      get().fetchBoard(projectId, tool as any);
    } catch (err: any) {
      console.error("Failed to update description", err);
      alert("Failed to update description: " + (err.response?.data?.detail || err.message));
    }
  },

  addColumn: async (projectId, tool, columnData) => {
    if (tool === 'jira') {
      alert("Jira columns (Statuses) must be created in the Jira Project Settings by an Administrator.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_BASE}/api/projects/${projectId}/board/columns?tool=${tool}`, 
        columnData,
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      get().fetchBoard(projectId, tool as any);
    } catch (err: any) {
      console.error("Failed to add column", err);
      alert("Failed to add column: " + (err.response?.data?.detail || err.message));
    }
  }
}));