import { useEffect, useState } from 'react';
import { Button, Space, Typography, Spin, Empty, message, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useCharacterStore } from '../stores/characterStore';
import { useProgressStore } from '../stores/progressStore';
import { CharacterCard } from '../components/character/CharacterCard';
import { CharacterFormModal } from '../components/character/CharacterFormModal';
import { Character, CreateCharacterData } from '../types';
import { AxiosError } from 'axios';

const { Title } = Typography;

export function CharactersPage() {
  const { characters, classes, isLoading, fetchCharacters, fetchClasses, createCharacter, updateCharacter, deleteCharacter } = useCharacterStore();
  const { pointsByCharacter, fetchAllCharactersPoints } = useProgressStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

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
                <CharacterCard
                  character={character}
                  achievementPoints={pointsByCharacter[character.id]}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
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
    </div>
  );
}
