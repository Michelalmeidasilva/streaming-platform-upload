/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';
import { useTheme } from '@/lib/theme/ThemeContext';

jest.mock('@/lib/theme/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('ThemeToggle', () => {
  const toggleTheme = jest.fn();

  it('renders light mode icon when effective theme is light', () => {
    (useTheme as jest.Mock).mockReturnValue({
      effectiveTheme: 'light',
      toggleTheme,
    });

    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
  });

  it('renders dark mode icon when effective theme is dark', () => {
    (useTheme as jest.Mock).mockReturnValue({
      effectiveTheme: 'dark',
      toggleTheme,
    });

    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
  });

  it('calls toggleTheme on click', () => {
    (useTheme as jest.Mock).mockReturnValue({
      effectiveTheme: 'light',
      toggleTheme,
    });

    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole('button'));
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});
