import api from './api';
import { Guild, GuildWithMembers, GuildInvitation, CreateGuildData } from '../types';

export const guildService = {
  async create(data: CreateGuildData): Promise<Guild> {
    const { data: guild } = await api.post<Guild>('/guilds', data);
    return guild;
  },

  async getById(id: string): Promise<{ guild: Guild; members: GuildWithMembers['members'] }> {
    const { data } = await api.get(`/guilds/${id}`);
    return data;
  },

  async invite(guildId: string, characterName: string): Promise<void> {
    await api.post(`/guilds/${guildId}/invite`, { characterName });
  },

  async removeMember(guildId: string, characterId: string): Promise<void> {
    await api.delete(`/guilds/${guildId}/members/${characterId}`);
  },

  async getInvitations(): Promise<GuildInvitation[]> {
    const { data } = await api.get<GuildInvitation[]>('/invitations');
    return data;
  },

  async acceptInvitation(token: string): Promise<void> {
    await api.post(`/invitations/${token}/accept`);
  },

  async declineInvitation(token: string): Promise<void> {
    await api.post(`/invitations/${token}/decline`);
  },
};
