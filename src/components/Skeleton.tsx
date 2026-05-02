'use client';

import styles from './Skeleton.module.css';

interface SkeletonProps {
  readonly width?: string | number;
  readonly height?: string | number;
  readonly variant?: 'text' | 'circle' | 'rect';
  readonly className?: string;
}

export default function Skeleton({
  width = '100%',
  height = '16px',
  variant = 'text',
  className,
}: Readonly<SkeletonProps>) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${className || ''}`}
      style={style}
    />
  );
}
