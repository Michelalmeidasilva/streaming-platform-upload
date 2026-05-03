/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import LoginPage from '../page';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  useSession: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('LoginPage', () => {
  const mockRouter = { push: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('renders login button when unauthenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated' });
    const { getByText } = render(<LoginPage />);
    expect(getByText('Continuar com Google')).toBeDefined();
  });

  it('calls signIn when button clicked', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated' });
    const { getByText } = render(<LoginPage />);
    fireEvent.click(getByText('Continuar com Google'));
    expect(signIn).toHaveBeenCalledWith('google');
  });

  it('redirects to home if already authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'authenticated' });
    render(<LoginPage />);
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });
});
