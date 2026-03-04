import { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Avatar, Dropdown, Typography, Space, Select, Tag, Button, theme } from 'antd';
import { ClassAvatar } from '../character/ClassAvatar';
import {
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  LogoutOutlined,
  TrophyOutlined,
  BookOutlined,
  StarOutlined,
  CaretDownOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { InvitationsFloat } from '../guild/InvitationsFloat';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGuildStore } from '../../stores/guildStore';
import { useCharacterStore } from '../../stores/characterStore';
import { useProgressStore } from '../../stores/progressStore';
import { useThemeStore } from '../../stores/themeStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { invitations, fetchInvitations } = useGuildStore();
  const { characters, selectedCharacterId, selectedCharacter, setSelectedCharacter, fetchCharacters } =
    useCharacterStore();
  const { fetchProgress, totalPoints, reset } = useProgressStore();
  const { isDark, toggle } = useThemeStore();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchInvitations();
    fetchCharacters();
  }, [fetchInvitations, fetchCharacters]);

  useEffect(() => {
    if (selectedCharacterId) {
      fetchProgress(selectedCharacterId);
    } else {
      reset();
    }
  }, [selectedCharacterId, fetchProgress, reset]);

  const menuItems = [
    {
      key: 'progression',
      type: 'group' as const,
      label: collapsed ? null : (
        <Text style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          Mon compte
        </Text>
      ),
      children: [
        { key: '/dashboard', icon: <HomeOutlined />, label: 'Tableau de bord' },
        { key: '/characters', icon: <UserOutlined />, label: 'Mes personnages' },
        {
          key: '/guild',
          icon: (
            <Badge count={invitations.length} size="small" offset={[4, -2]}>
              <TeamOutlined />
            </Badge>
          ),
          label: (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Guilde</span>
              {invitations.length > 0 && !collapsed && (
                <Badge count={invitations.length} size="small" style={{ marginLeft: 8, backgroundColor: '#c0902b' }} />
              )}
            </span>
          ),
        },
      ],
    },
    {
      key: 'encyclopedie',
      type: 'group' as const,
      label: collapsed ? null : (
        <Text
          style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}
        >
          Encyclopédie
        </Text>
      ),
      children: [
        { key: '/achievements', icon: <StarOutlined />, label: 'Succès' },
        { key: '/quests', icon: <BookOutlined />, label: 'Quêtes' },
      ],
    },
  ];

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Déconnexion',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={220}>
        <div style={{ padding: '16px', textAlign: 'center', color: '#c0902b' }}>
          <TrophyOutlined style={{ fontSize: 24 }} />
          {!collapsed && (
            <div
              style={{ marginTop: 4, fontSize: 13, color: '#c0902b', fontWeight: 'bold', letterSpacing: 0.5 }}
            >
              Dofus Progress
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            gap: 16,
          }}
        >
          {/* Sélecteur de personnage actif */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              Personnage actif :
            </Text>
            {characters.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                —
              </Text>
            ) : (
              <Select
                value={selectedCharacterId ?? undefined}
                onChange={setSelectedCharacter}
                style={{ minWidth: 180 }}
                placeholder="Choisir un personnage"
                suffixIcon={<CaretDownOutlined />}
                options={characters.map((c) => ({
                  value: c.id,
                  label: (
                    <Space size={6}>
                      <ClassAvatar className={c.characterClass} size={20} />
                      <Text strong style={{ fontSize: 13 }}>
                        {c.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {c.characterClass} niv.{c.level}
                      </Text>
                    </Space>
                  ),
                }))}
              />
            )}
            {selectedCharacter && totalPoints > 0 && (
              <Tag icon={<TrophyOutlined />} color="gold" style={{ fontSize: 12 }}>
                {totalPoints} pts
              </Tag>
            )}
          </div>

          {/* Actions header */}
          <Space>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggle}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
            />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#c0902b' }} />
                <Text strong>{user?.username}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '16px', background: token.colorBgLayout, minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>
      </Layout>
      <InvitationsFloat />
    </Layout>
  );
}
