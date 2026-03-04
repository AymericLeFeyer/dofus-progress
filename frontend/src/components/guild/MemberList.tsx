import { List, Tag, Space, Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined, TrophyOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import { GuildMember } from '../../types';
import type { GuildMemberProgress } from '../../services/progress.service';
import { ClassAvatar } from '../character/ClassAvatar';

const { Text } = Typography;

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  leader: { label: 'Chef', color: 'gold' },
  officer: { label: 'Officier', color: 'blue' },
  member: { label: 'Membre', color: 'default' },
};

interface Props {
  members: GuildMember[];
  leaderId: string;
  canManage: boolean;
  onRemove: (characterId: string) => void;
  onMemberClick?: (characterId: string) => void;
  progressMap?: Record<string, GuildMemberProgress>;
}

export function MemberList({ members, leaderId, canManage, onRemove, onMemberClick, progressMap }: Props) {
  return (
    <List
      dataSource={members}
      renderItem={(member) => {
        const role = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
        const isLeader = member.characterId === leaderId;
        const progress = progressMap?.[member.characterId];

        return (
          <List.Item
            style={{ cursor: onMemberClick ? 'pointer' : undefined }}
            onClick={() => onMemberClick?.(member.characterId)}
            actions={
              canManage && !isLeader
                ? [
                    <Popconfirm
                      key="remove"
                      title="Retirer ce membre ?"
                      onConfirm={(e) => { e?.stopPropagation(); onRemove(member.characterId); }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="Retirer"
                      cancelText="Annuler"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        icon={<DeleteOutlined />}
                        size="small"
                        danger
                        type="text"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              avatar={<ClassAvatar className={member.character.class} size={40} showTooltip />}
              title={
                <Space size={6}>
                  <Text strong>{member.character.name}</Text>
                  <Tag color={role.color} style={{ margin: 0 }}>{role.label}</Tag>
                </Space>
              }
              description={
                <Space direction="vertical" size={2} style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {member.character.class} — Niv. {member.character.level}
                  </Text>
                  {progress && (
                    <Space size={10} wrap>
                      <Text style={{ fontSize: 12, color: '#c0902b' }}>
                        <TrophyOutlined style={{ marginRight: 3 }} />
                        {progress.totalPoints} pts
                      </Text>
                      <Text style={{ fontSize: 12, color: '#52c41a' }}>
                        <CheckCircleOutlined style={{ marginRight: 3 }} />
                        {progress.completedQuestIds.length} terminées
                      </Text>
                      {progress.startedQuestIds.length > 0 && (
                        <Text style={{ fontSize: 12, color: '#1677ff' }}>
                          <ClockCircleOutlined style={{ marginRight: 3 }} />
                          {progress.startedQuestIds.length} en cours
                        </Text>
                      )}
                      {(progress.blockedQuestIds ?? []).length > 0 && (
                        <Text style={{ fontSize: 12, color: '#ff4d4f' }}>
                          <StopOutlined style={{ marginRight: 3 }} />
                          {(progress.blockedQuestIds ?? []).length} bloquée{(progress.blockedQuestIds ?? []).length > 1 ? 's' : ''}
                        </Text>
                      )}
                    </Space>
                  )}
                </Space>
              }
            />
          </List.Item>
        );
      }}
    />
  );
}
