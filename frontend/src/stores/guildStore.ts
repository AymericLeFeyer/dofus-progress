import { create } from 'zustand';
import { Guild, GuildMember, GuildInvitation, CreateGuildData } from '../types';
import { guildService } from '../services/guild.service';

interface GuildStore {
  guild: Guild | null;
  members: GuildMember[];
  invitations: GuildInvitation[];
  isLoading: boolean;
  fetchGuild: (guildId: string) => Promise<void>;
  createGuild: (data: CreateGuildData) => Promise<Guild>;
  inviteCharacter: (guildId: string, characterName: string) => Promise<void>;
  removeMember: (guildId: string, characterId: string) => Promise<void>;
  fetchInvitations: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
  declineInvitation: (token: string) => Promise<void>;
}

export const useGuildStore = create<GuildStore>((set) => ({
  guild: null,
  members: [],
  invitations: [],
  isLoading: false,

  fetchGuild: async (guildId) => {
    set({ isLoading: true });
    try {
      const { guild, members } = await guildService.getById(guildId);
      set({ guild, members, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createGuild: async (data) => {
    const guild = await guildService.create(data);
    set({ guild });
    return guild;
  },

  inviteCharacter: async (guildId, characterName) => {
    await guildService.invite(guildId, characterName);
  },

  removeMember: async (guildId, characterId) => {
    await guildService.removeMember(guildId, characterId);
    set((state) => ({
      members: state.members.filter((m) => m.characterId !== characterId),
    }));
  },

  fetchInvitations: async () => {
    try {
      const invitations = await guildService.getInvitations();
      set({ invitations });
    } catch {
      // invitations stay empty
    }
  },

  acceptInvitation: async (token) => {
    await guildService.acceptInvitation(token);
    set((state) => ({
      invitations: state.invitations.filter((i) => i.token !== token),
    }));
  },

  declineInvitation: async (token) => {
    await guildService.declineInvitation(token);
    set((state) => ({
      invitations: state.invitations.filter((i) => i.token !== token),
    }));
  },
}));
