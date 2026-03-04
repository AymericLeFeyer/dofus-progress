import { Modal, Form, Input } from 'antd';

interface Props {
  open: boolean;
  onSubmit: (characterName: string) => Promise<void>;
  onCancel: () => void;
}

export function InviteModal({ open, onSubmit, onCancel }: Props) {
  const [form] = Form.useForm<{ characterName: string }>();

  const handleOk = async () => {
    const { characterName } = await form.validateFields();
    await onSubmit(characterName);
    form.resetFields();
  };

  return (
    <Modal
      title="Inviter un personnage"
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel(); }}
      okText="Inviter"
      cancelText="Annuler"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="characterName"
          label="Nom du personnage"
          rules={[{ required: true, message: 'Entrez un nom de personnage' }]}
        >
          <Input placeholder="Nom exact du personnage" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
