import { IGuildRepository, GuildMemberWithCharacter, GuildInvitationWithGuild } from './IGuildRepository';
import { ICharacterRepository } from '../character/ICharacterRepository';
import { Guild, CreateGuildData } from './Guild.entity';
import { GuildRole } from './GuildMember.entity';
import { InvitationStatus } from './GuildInvitation.entity';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export class GuildService {
  constructor(
    private readonly guildRepository: IGuildRepository,
    private readonly characterRepository: ICharacterRepository,
  ) {}

  async createGuild(userId: string, leaderCharacterId: string, name: string, imageUrl?: string): Promise<Guild> {
    const leader = await this.characterRepository.findById(leaderCharacterId);
    if (!leader) throw new NotFoundError('Personnage');
    if (leader.userId !== userId) throw new ForbiddenError();

    const existingMember = await this.guildRepository.findMemberByCharacterId(leaderCharacterId);
    if (existingMember) throw new AppError('Ce personnage est déjà dans une guilde', 409);

    const existingGuild = await this.guildRepository.findByName(name);
    if (existingGuild) throw new ConflictError('Une guilde avec ce nom existe déjà');

    const guild = await this.guildRepository.create({ name, leaderId: leaderCharacterId, imageUrl });
    await this.guildRepository.addMember(guild.id, leaderCharacterId, GuildRole.LEADER);

    return guild;
  }

  async getGuild(guildId: string): Promise<{ guild: Guild; members: GuildMemberWithCharacter[] }> {
    const guild = await this.guildRepository.findById(guildId);
    if (!guild) throw new NotFoundError('Guilde');

    const members = await this.guildRepository.findMembers(guildId);
    return { guild, members };
  }

  async inviteCharacter(userId: string, guildId: string, targetCharacterName: string): Promise<void> {
    const guild = await this.guildRepository.findById(guildId);
    if (!guild) throw new NotFoundError('Guilde');

    // Verify requester has a character that is leader/officer in this guild
    const userCharacters = await this.characterRepository.findByUserId(userId);
    const requesterMember = await Promise.all(
      userCharacters.map((c) => this.guildRepository.findMemberByCharacterId(c.id)),
    ).then((members) => members.find((m) => m?.guildId === guildId));

    if (!requesterMember || !requesterMember.canManageMembers()) {
      throw new ForbiddenError('Seul le chef ou un officier peut inviter des membres');
    }

    const targetCharacter = await this.characterRepository.findByName(targetCharacterName);
    if (!targetCharacter) throw new NotFoundError(`Personnage "${targetCharacterName}"`);

    const existingMember = await this.guildRepository.findMemberByCharacterId(targetCharacter.id);
    if (existingMember) {
      if (existingMember.guildId === guildId) throw new ConflictError('Ce personnage est déjà dans cette guilde');
      throw new ConflictError('Ce personnage est déjà dans une guilde');
    }

    const existingInvite = await this.guildRepository.findPendingInvitationByGuildAndCharacter(guildId, targetCharacter.id);
    if (existingInvite) throw new ConflictError('Une invitation est déjà en attente pour ce personnage');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.guildRepository.createInvitation({ guildId, characterId: targetCharacter.id, expiresAt });
  }

  async acceptInvitation(userId: string, token: string): Promise<void> {
    const invitation = await this.guildRepository.findInvitationByToken(token);
    if (!invitation) throw new NotFoundError('Invitation');

    if (!invitation.isPending()) throw new AppError("Cette invitation n'est plus valide", 410);

    const character = await this.characterRepository.findById(invitation.characterId);
    if (!character || character.userId !== userId) throw new ForbiddenError();

    const existingMember = await this.guildRepository.findMemberByCharacterId(character.id);
    if (existingMember) throw new ConflictError('Ce personnage est déjà dans une guilde');

    await this.guildRepository.updateInvitationStatus(invitation.id, InvitationStatus.ACCEPTED);
    await this.guildRepository.addMember(invitation.guildId, character.id, GuildRole.MEMBER);
  }

  async declineInvitation(userId: string, token: string): Promise<void> {
    const invitation = await this.guildRepository.findInvitationByToken(token);
    if (!invitation) throw new NotFoundError('Invitation');

    if (!invitation.isPending()) throw new AppError("Cette invitation n'est plus valide", 410);

    const character = await this.characterRepository.findById(invitation.characterId);
    if (!character || character.userId !== userId) throw new ForbiddenError();

    await this.guildRepository.updateInvitationStatus(invitation.id, InvitationStatus.DECLINED);
  }

  async removeMember(userId: string, guildId: string, targetCharacterId: string): Promise<void> {
    const guild = await this.guildRepository.findById(guildId);
    if (!guild) throw new NotFoundError('Guilde');

    const userCharacters = await this.characterRepository.findByUserId(userId);
    const requesterMember = await Promise.all(
      userCharacters.map((c) => this.guildRepository.findMemberByCharacterId(c.id)),
    ).then((members) => members.find((m) => m?.guildId === guildId));

    if (!requesterMember || !requesterMember.canManageMembers()) {
      throw new ForbiddenError('Seul le chef ou un officier peut retirer des membres');
    }

    if (targetCharacterId === guild.leaderId) {
      throw new AppError('Impossible de retirer le chef de guilde', 409);
    }

    const targetMember = await this.guildRepository.findMemberByCharacterId(targetCharacterId);
    if (!targetMember || targetMember.guildId !== guildId) throw new NotFoundError('Membre');

    await this.guildRepository.removeMember(guildId, targetCharacterId);
  }

  async getPendingInvitationsForUser(userId: string): Promise<GuildInvitationWithGuild[]> {
    const characters = await this.characterRepository.findByUserId(userId);
    const invitationsArrays = await Promise.all(
      characters.map((c) => this.guildRepository.findPendingInvitationsByCharacterId(c.id)),
    );
    return invitationsArrays.flat();
  }
}
