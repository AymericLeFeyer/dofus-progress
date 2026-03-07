import { useEffect, useState } from 'react';
import { Drawer, Space, Statistic, Row, Col, Typography, Button, List, Tag, Skeleton } from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { GuildMemberProgress } from '../../services/progress.service';
import { dofusdbService, levelRange } from '../../services/dofusdb.service';
import { ClassAvatar } from '../character/ClassAvatar';

const { Text, Title } = Typography;

type QuestStub = {
  id: number;
  name: { fr: string };
  categoryId: number;
  levelMin: number;
  levelMax: number;
  isDungeonQuest: boolean;
  isPartyQuest: boolean;
  isEvent: boolean;
};

interface Props {
  member: GuildMemberProgress | null;
  open: boolean;
  onClose: () => void;
  onQuestClick: (questId: number) => void;
  catNames: Record<number, string>;
}

export function MemberProgressDrawer({ member, open, onClose, onQuestClick, catNames }: Props) {
  const navigate = useNavigate();
  const [questMap, setQuestMap] = useState<Record<number, QuestStub>>({});
  const [questsLoading, setQuestsLoading] = useState(false);

  useEffect(() => {
    if (!member) return;
    const ids = [...(member.startedQuestIds ?? []), ...(member.blockedQuestIds ?? [])];
    if (!ids.length) { setQuestMap({}); return; }
    setQuestsLoading(true);
    dofusdbService.getQuestsByIds(ids).then((quests) => {
      const map: Record<number, QuestStub> = {};
      (quests as QuestStub[]).forEach((q) => { map[q.id] = q; });
      setQuestMap(map);
    }).catch(() => {}).finally(() => setQuestsLoading(false));
  }, [member?.characterId]);

  if (!member) return null;

  function QuestItem({ questId, color }: { questId: number; color: string }) {
    const q = questMap[questId];
    return (
      <List.Item
        style={{ padding: '6px 0', cursor: 'pointer' }}
        onClick={() => onQuestClick(questId)}
      >
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text style={{ fontSize: 13, color: '#1677ff' }}>
            {q ? q.name.fr : `Quête #${questId}`}
          </Text>
          {q && (
            <Space size={4} wrap>
              {catNames[q.categoryId] && (
                <Tag style={{ fontSize: 11, marginRight: 0 }}>{catNames[q.categoryId]}</Tag>
              )}
              {levelRange(q.levelMin, q.levelMax) && (
                <Tag color="orange" style={{ fontSize: 11, marginRight: 0 }}>
                  {levelRange(q.levelMin, q.levelMax)}
                </Tag>
              )}
              {q.isDungeonQuest && <Tag color="volcano" style={{ fontSize: 11, marginRight: 0 }}>Donjon</Tag>}
              {q.isPartyQuest && <Tag color="purple" style={{ fontSize: 11, marginRight: 0 }}>Groupe</Tag>}
            </Space>
          )}
        </Space>
        <Tag color={color} style={{ marginLeft: 8, flexShrink: 0 }}>›</Tag>
      </List.Item>
    );
  }

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
      width={420}
      extra={
        <Button size="small" onClick={() => { onClose(); navigate(`/profile/${member.characterId}`); }}>
          Voir profil complet
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Stats succès */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Succès</Text>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Succès obtenus"
                value={member.achievementCount}
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

        {/* Stats quêtes */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Quêtes</Text>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Terminées"
                value={member.completedQuestCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: 18 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="En cours"
                value={member.startedQuestCount}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1677ff', fontSize: 18 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Bloquées"
                value={member.blockedQuestCount}
                prefix={<StopOutlined />}
                valueStyle={{ color: member.blockedQuestCount > 0 ? '#ff4d4f' : undefined, fontSize: 18 }}
              />
            </Col>
          </Row>
        </div>

        {/* Quêtes en cours */}
        {(member.startedQuestIds ?? []).length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <ClockCircleOutlined style={{ color: '#1677ff', marginRight: 6 }} />
              Quêtes en cours ({member.startedQuestIds.length})
            </Text>
            {questsLoading ? (
              <Skeleton active paragraph={{ rows: Math.min(member.startedQuestIds.length, 3) }} />
            ) : (
              <List
                size="small"
                dataSource={member.startedQuestIds}
                renderItem={(qid) => <QuestItem key={qid} questId={qid} color="blue" />}
              />
            )}
          </div>
        )}

        {/* Quêtes bloquées */}
        {(member.blockedQuestIds ?? []).length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <BookOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
              Quêtes bloquées ({member.blockedQuestIds.length})
            </Text>
            {questsLoading ? (
              <Skeleton active paragraph={{ rows: Math.min(member.blockedQuestIds.length, 3) }} />
            ) : (
              <List
                size="small"
                dataSource={member.blockedQuestIds}
                renderItem={(qid) => <QuestItem key={qid} questId={qid} color="red" />}
              />
            )}
          </div>
        )}
      </Space>
    </Drawer>
  );
}
