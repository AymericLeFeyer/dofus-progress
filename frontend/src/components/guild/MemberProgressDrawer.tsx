import { Drawer, Space, Statistic, Row, Col, Typography, Button } from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
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
      </Space>
    </Drawer>
  );
}
