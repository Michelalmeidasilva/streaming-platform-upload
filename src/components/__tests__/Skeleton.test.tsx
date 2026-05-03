/** @jest-environment jsdom */
import React from 'react';
import { render } from '@testing-library/react';
import Skeleton from '../Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('skeleton');
    expect(div).toHaveClass('text');
    expect(div.style.width).toBe('100%');
    expect(div.style.height).toBe('16px');
  });

  it('renders with custom props', () => {
    const { container } = render(
      <Skeleton width={200} height={50} variant="circle" className="custom-class" />
    );
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('skeleton');
    expect(div).toHaveClass('circle');
    expect(div).toHaveClass('custom-class');
    expect(div.style.width).toBe('200px');
    expect(div.style.height).toBe('50px');
  });

  it('handles string dimensions', () => {
    const { container } = render(<Skeleton width="50vw" height="2rem" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('50vw');
    expect(div.style.height).toBe('2rem');
  });
});
