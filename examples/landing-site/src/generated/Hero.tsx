import React from 'react';
import { Heading, Eyebrow, Button, Stack } from '@ds';

/**
 * Landing hero — composes the active design system's primitives, token roles only.
 * On-system by construction: swap the design system and it re-skins (Atelier → Noir).
 */
export function Hero() {
  return (
    <div className="bg-surface text-text" style={{ padding: 96 }}>
      <Stack gap={3} className="items-start" style={{ maxWidth: '64ch' }}>
        <Eyebrow>medesign</Eyebrow>
        <Heading level={1} size="display">Kỹ thuật thiết kế — đúng hệ thống ngay từ trong cấu trúc.</Heading>
        <p className="font-[var(--font-sans)] text-text-muted" style={{ fontSize: 18, lineHeight: 1.6 }}>
          Chọn một hệ thống thiết kế, rồi tạo nên các thành phần luôn nhất quán, kiểm thử được và sẵn sàng
          phát hành — được xác minh theo hợp đồng token, không phải theo cảm tính.
        </p>
        <Stack direction="row" gap={2}>
          <Button>Bắt đầu dự án</Button>
          <Button variant="secondary">Đọc bản đặc tả</Button>
        </Stack>
      </Stack>
    </div>
  );
}
