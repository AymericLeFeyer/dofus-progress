import { useEffect } from 'react';
import { Row, Col, Card, Typography, Space, Button, Empty, Statistic } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCharacterStore } from '../stores/characterStore';
import { useProgressStore } from '../stores/progressStore';

const { Title, Text } = Typography;

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { characters, fetchCharacters, selectedCharacterId } = useCharacterStore();
  const {
    completedAchievementIds,
    completedQuestIds,
    startedQuestIds,
    blockedQuestIds,
    totalPoints,
    fetchProgress,
    isLoading: progressLoading,
  } = useProgressStore();

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  useEffect(() => {
    if (selectedCharacterId) {
      fetchProgress(selectedCharacterId);
    }
  }, [selectedCharacterId, fetchProgress]);

  const guildCharacters = characters.filter((c) => c.guildMember);
  const selectedChar = characters.find((c) => c.id === selectedCharacterId);

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Bienvenue, {user?.username} !
          </Title>
          <Text type="secondary">Votre tableau de bord Dofus Progress</Text>
        </div>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic title="Personnages" value={characters.length} prefix={<UserOutlined />} valueStyle={{ color: '#c0902b' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic title="En guilde" value={guildCharacters.length} prefix={<TeamOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
        </Row>

        {selectedChar && (
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#c0902b' }} />
                <span>Ma progression — {selectedChar.name}</span>
              </Space>
            }
            loading={progressLoading}
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Succès obtenus"
                  value={completedAchievementIds.size}
                  prefix={<TrophyOutlined />}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>{totalPoints} pts</Text>}
                  valueStyle={{ color: '#c0902b' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Quêtes terminées"
                  value={completedQuestIds.size}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="En cours"
                  value={startedQuestIds.size}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Bloquées"
                  value={blockedQuestIds.size}
                  prefix={<StopOutlined />}
                  valueStyle={{ color: blockedQuestIds.size > 0 ? '#ff4d4f' : undefined }}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={() => navigate('/quests')}>
                <BookOutlined /> Quêtes
              </Button>
              <Button onClick={() => navigate('/achievements')}>
                <TrophyOutlined /> Succès
              </Button>
              {selectedCharacterId && (
                <Button onClick={() => navigate(`/profile/${selectedCharacterId}`)}>
                  <ProfileOutlined /> Mon profil
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card
          title={<Space><UserOutlined /><span>Mes personnages</span></Space>}
          extra={<Button type="link" onClick={() => navigate('/characters')}>Gérer</Button>}
        >
          {characters.length === 0 ? (
            <Empty description="Aucun personnage" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={() => navigate('/characters')} style={{ background: '#c0902b', borderColor: '#c0902b' }}>
                Créer un personnage
              </Button>
            </Empty>
          ) : (
            <Row gutter={[8, 8]}>
              {characters.map((c) => (
                <Col key={c.id} xs={24} sm={12} lg={8}>
                  <Card size="small">
                    <Space direction="vertical" size={2}>
                      <Text strong>{c.name}</Text>
                      <Text type="secondary">{c.characterClass} — Niv. {c.level}</Text>
                      {c.guildMember ? (
                        <Text style={{ color: '#52c41a' }}>
                          <TeamOutlined /> {c.guildMember.guild.name}
                        </Text>
                      ) : (
                        <Text type="secondary">Sans guilde</Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        {guildCharacters.length === 0 && characters.length > 0 && (
          <Card
            title={<Space><TrophyOutlined /><span>Rejoindre une guilde</span></Space>}
          >
            <Text>Aucun de vos personnages n'est dans une guilde. Créez une guilde ou attendez une invitation !</Text>
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => navigate('/guild')}>Gérer ma guilde</Button>
            </div>
          </Card>
        )}
      </Space>
    </div>
  );
}
