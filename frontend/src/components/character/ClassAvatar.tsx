import { Avatar, Tooltip } from 'antd';
import { classImageUrl } from '../../utils/classImage';

interface Props {
  className: string;
  size?: number | 'small' | 'default' | 'large';
  showTooltip?: boolean;
}

export function ClassAvatar({ className, size = 'default', showTooltip = false }: Props) {
  const url = classImageUrl(className);

  const avatar = url ? (
    <Avatar
      src={url}
      size={size}
      style={{ background: '#1a1a2e', flexShrink: 0 }}
    />
  ) : (
    <Avatar
      size={size}
      style={{ background: '#c0902b', color: '#fff', flexShrink: 0 }}
    >
      {className.charAt(0)}
    </Avatar>
  );

  if (showTooltip) {
    return <Tooltip title={className}>{avatar}</Tooltip>;
  }
  return avatar;
}
