import { Drawer, Space, Statistic, Row, Col, Tag, Typography, Empty, Button } from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { GuildMemberProgress } from '../../services/progress.service';
import { ClassAvatar } from '../character/ClassAvatar';

const { Text, Title } = Typography;

interface Props {
  member: GuildMemberProgress | null;
  open: boolean;
  onClose: () => void;
}

export function MemberProgressDrawer({ member, open, onClose }: Props) {
  const navigate = useNavigate();
  if (!member) return null;

  const blockedQuestIds = member.blockedQuestIds ?? [];
  const startedQuestIds = member.startedQuestIds ?? [];

  // Top 5 catégories avec activité (en cours + bloqué)
  const activityByCat: Record<number, { started: number; blocked: number }> = {};
  const startedCats = member.startedQuestCategoryProgress ?? {};
  const blockedCats = member.blockedQuestCategoryProgress ?? {};
  const allCatIds = new Set([...Object.keys(startedCats), ...Object.keys(blockedCats)]);
  allCatIds.forEach((catId) => {
    const id = Number(catId);
    activityByCat[id] = {
      started: startedCats[id] ?? 0,
      blocked: blockedCats[id] ?? 0,
    };
  });

  const topCategories = Object.entries(activityByCat)
    .map(([catId, counts]) => ({ catId: Number(catId), total: counts.started + counts.blocked, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <Drawer
      title={
        <Space>
          <ClassAvatar className={member.class} size={32} />
          <Title level={5} style={{ margin: 0 }}>{member.name}</Title>
          <Text type="secondary">{member.class} — Niv. {member.level}</Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={400}
      extra={
        <Button size="small" onClick={() => { onClose(); navigate(`/profile/${member.characterId}`); }}>
          Voir profil complet
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Succès</Text>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Succès obtenus"
                value={member.completedAchievementIds.length}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#c0902b', fontSize: 20 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Points"
                value={member.totalPoints}
                valueStyle={{ color: '#c0902b', fontSize: 20 }}
              />
            </Col>
          </Row>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Quêtes</Text>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Terminées"
                value={member.completedQuestIds.length}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: 18 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="En cours"
                value={startedQuestIds.length}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1677ff', fontSize: 18 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Bloquées"
                value={blockedQuestIds.length}
                prefix={<StopOutlined />}
                valueStyle={{ color: blockedQuestIds.length > 0 ? '#ff4d4f' : undefined, fontSize: 18 }}
              />
            </Col>
          </Row>
        </div>

        {topCategories.length > 0 ? (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              <BookOutlined /> Catégories actives (top 5)
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {topCategories.map(({ catId, started, blocked }) => (
                <div
                  key={catId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    background: '#fafafa',
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>Catégorie #{catId}</Text>
                  <Space size={4}>
                    {started > 0 && (
                      <Tag color="blue" style={{ margin: 0 }}>{started} en cours</Tag>
                    )}
                    {blocked > 0 && (
                      <Tag color="red" style={{ margin: 0 }}>{blocked} bloqué{blocked > 1 ? 's' : ''}</Tag>
                    )}
                  </Space>
                </div>
              ))}
            </Space>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Aucune activité enregistrée"
          />
        )}
      </Space>
    </Drawer>
  );
}
