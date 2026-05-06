import { useEffect, useState } from 'react';
import { Button, Space, Typography, Spin, Empty, message, Row, Col, Drawer, Tag, Divider, List, Tooltip } from 'antd';
import { PlusOutlined, TrophyOutlined, BookOutlined, CheckCircleOutlined, StopOutlined, ClockCircleOutlined, CommentOutlined } from '@ant-design/icons';
import { useCharacterStore } from '../stores/characterStore';
import { useProgressStore } from '../stores/progressStore';
import { CharacterCard } from '../components/character/CharacterCard';
import { CharacterFormModal } from '../components/character/CharacterFormModal';
import { Character, CreateCharacterData } from '../types';
import { AxiosError } from 'axios';
import { progressService, CharacterProfile } from '../services/progress.service';
import { dofusdbService } from '../services/dofusdb.service';
import type { Dungeon, Quest } from '../types/dofusdb';

const { Title, Text } = Typography;

export function CharactersPage() {
  const { characters, classes, isLoading, fetchCharacters, fetchClasses, createCharacter, updateCharacter, deleteCharacter } = useCharacterStore();
  const { pointsByCharacter, fetchAllCharactersPoints } = useProgressStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [profileCharacter, setProfileCharacter] = useState<Character | null>(null);
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [questMap, setQuestMap] = useState<Map<number, Quest>>(new Map());
  const [dungeonMap, setDungeonMap] = useState<Map<number, Dungeon>>(new Map());

  useEffect(() => {
    fetchCharacters();
    fetchClasses();
    fetchAllCharactersPoints();
  }, [fetchCharacters, fetchClasses, fetchAllCharactersPoints]);

  const handleSubmit = async (data: CreateCharacterData) => {
    try {
      if (editingCharacter) {
        await updateCharacter(editingCharacter.id, data);
        message.success('Personnage modifié');
      } else {
        await createCharacter(data);
        message.success('Personnage créé');
      }
      setModalOpen(false);
      setEditingCharacter(null);
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleEdit = (character: Character) => {
    setEditingCharacter(character);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCharacter(id);
      message.success('Personnage supprimé');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur lors de la suppression';
      message.error(msg);
    }
  };

  const openProfile = async (character: Character) => {
    setProfileCharacter(character);
    setProfileDrawerOpen(true);
    setProfile(null);
    setProfileLoading(true);
    try {
      const data = await progressService.getProfile(character.id);
      setProfile(data);

      const allQuestIds = [
        ...data.startedQuestIds,
        ...data.blockedQuestIds,
      ];
      const allDungeonIds = data.todoDungeonIds;

      const [quests, dungeons] = await Promise.all([
        allQuestIds.length > 0 ? dofusdbService.getQuestsByIds(allQuestIds) : Promise.resolve([]),
        allDungeonIds.length > 0 ? dofusdbService.getAllDungeons() : Promise.resolve([]),
      ]);

      setQuestMap(new Map((quests as Quest[]).map((q) => [q.id, q])));
      setDungeonMap(new Map((dungeons as Dungeon[]).filter((d) => allDungeonIds.includes(d.id)).map((d) => [d.id, d])));
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>Mes personnages</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingCharacter(null); setModalOpen(true); }}
            style={{ background: '#c0902b', borderColor: '#c0902b' }}
          >
            Nouveau personnage
          </Button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : characters.length === 0 ? (
          <Empty description="Aucun personnage" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => setModalOpen(true)} style={{ background: '#c0902b', borderColor: '#c0902b' }}>
              Créer mon premier personnage
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {characters.map((character) => (
              <Col key={character.id} xs={24} md={12} xl={8}>
                <div
                  style={{ cursor: 'pointer' }}
                  onClick={() => openProfile(character)}
                >
                  <CharacterCard
                    character={character}
                    achievementPoints={pointsByCharacter[character.id]}
                    onEdit={(c) => { handleEdit(c); }}
                    onDelete={handleDelete}
                  />
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Space>

      <CharacterFormModal
        open={modalOpen}
        character={editingCharacter}
        classes={classes}
        onSubmit={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditingCharacter(null); }}
      />

      <Drawer
        title={profileCharacter ? `${profileCharacter.name} — Profil` : 'Profil'}
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        width={500}
      >
        {profileLoading || !profile ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <Text strong style={{ fontSize: 18 }}>{profile.character.name}</Text>
                <br />
                <Space size={6} style={{ marginTop: 4 }}>
                  <Tag color="orange">{profile.character.class}</Tag>
                  <Tag>Niv. {profile.character.level}</Tag>
                  {profile.character.guild && <Tag color="gold">{profile.character.guild.name}</Tag>}
                </Space>
              </div>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* Succès */}
            <div>
              <Space style={{ marginBottom: 8 }}>
                <TrophyOutlined style={{ color: '#c0902b' }} />
                <Text strong>Succès</Text>
              </Space>
              <div style={{ display: 'flex', gap: 12 }}>
                <Tag icon={<TrophyOutlined />} color="gold">
                  {profile.completedAchievementIds.length} succès
                </Tag>
                <Tag icon={<TrophyOutlined />} color="orange">
                  {profile.totalPoints} pts
                </Tag>
              </div>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* Quêtes */}
            <div>
              <Space style={{ marginBottom: 8 }}>
                <BookOutlined style={{ color: '#1677ff' }} />
                <Text strong>Quêtes</Text>
              </Space>
              <Space size={8} wrap style={{ marginBottom: 12 }}>
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {profile.completedQuestIds.length} terminées
                </Tag>
                <Tag icon={<ClockCircleOutlined />} color="processing">
                  {profile.startedQuestIds.length} en cours
                </Tag>
                <Tag icon={<StopOutlined />} color="error">
                  {profile.blockedQuestIds.length} bloquées
                </Tag>
              </Space>

              {profile.startedQuestIds.length > 0 && (
                <>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>En cours</Text>
                  <List
                    size="small"
                    dataSource={profile.startedQuestIds}
                    style={{ marginBottom: 12 }}
                    renderItem={(qid) => {
                      const quest = questMap.get(qid);
                      const comment = profile.questComments?.[qid];
                      return (
                        <List.Item style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>En cours</Tag>
                            <Text style={{ flex: 1, fontSize: 13 }} ellipsis={{ tooltip: quest?.name.fr ?? `Quête #${qid}` }}>
                              {quest?.name.fr ?? `Quête #${qid}`}
                            </Text>
                            {comment && (
                              <Tooltip title={comment}>
                                <CommentOutlined style={{ color: '#c0902b', fontSize: 13, flexShrink: 0 }} />
                              </Tooltip>
                            )}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </>
              )}

              {profile.blockedQuestIds.length > 0 && (
                <>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Bloquées</Text>
                  <List
                    size="small"
                    dataSource={profile.blockedQuestIds}
                    renderItem={(qid) => {
                      const quest = questMap.get(qid);
                      const comment = profile.questComments?.[qid];
                      return (
                        <List.Item style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <Tag color="red" style={{ margin: 0, fontSize: 11 }}>Bloquée</Tag>
                            <Text style={{ flex: 1, fontSize: 13 }} ellipsis={{ tooltip: quest?.name.fr ?? `Quête #${qid}` }}>
                              {quest?.name.fr ?? `Quête #${qid}`}
                            </Text>
                            {comment && (
                              <Tooltip title={comment}>
                                <CommentOutlined style={{ color: '#c0902b', fontSize: 13, flexShrink: 0 }} />
                              </Tooltip>
                            )}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </>
              )}
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* Donjons */}
            <div>
              <Space style={{ marginBottom: 8 }}>
                <CheckCircleOutlined style={{ color: '#c0902b' }} />
                <Text strong>Donjons</Text>
              </Space>
              <Space size={8} wrap style={{ marginBottom: 12 }}>
                <Tag color="warning">{profile.todoDungeonIds.length} à faire</Tag>
                <Tag color="success">{profile.doneDungeonIds.length} faits</Tag>
              </Space>

              {profile.todoDungeonIds.length > 0 && (
                <>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>À faire</Text>
                  <List
                    size="small"
                    dataSource={profile.todoDungeonIds}
                    renderItem={(did) => {
                      const dungeon = dungeonMap.get(did);
                      const comment = profile.dungeonComments?.[did];
                      return (
                        <List.Item style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <Tag color="red" style={{ margin: 0, fontSize: 11 }}>À faire</Tag>
                            <Text style={{ flex: 1, fontSize: 13 }} ellipsis={{ tooltip: dungeon?.name.fr ?? `Donjon #${did}` }}>
                              {dungeon?.name.fr ?? `Donjon #${did}`}
                            </Text>
                            {comment && (
                              <Tooltip title={comment}>
                                <CommentOutlined style={{ color: '#c0902b', fontSize: 13, flexShrink: 0 }} />
                              </Tooltip>
                            )}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </>
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
