/** @jest-environment jsdom */
import React from 'react';
import { render } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders correctly', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeDefined();
    // Since we use identity-obj-proxy, styles.container becomes "container"
    expect(container.firstChild).toHaveClass('container');
  });
});
