import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RetrievalStateBadge from './RetrievalStateBadge';

describe('RetrievalStateBadge', () => {
  it('renders "Grounded" for grounded state', () => {
    render(<RetrievalStateBadge state="grounded" />);
    expect(screen.getByText('Grounded')).toBeInTheDocument();
  });

  it('renders "Degraded retrieval" for degraded state', () => {
    render(<RetrievalStateBadge state="degraded" />);
    expect(screen.getByText('Degraded retrieval')).toBeInTheDocument();
  });

  it('renders "Data gap" for data-gap state', () => {
    render(<RetrievalStateBadge state="data-gap" />);
    expect(screen.getByText('Data gap')).toBeInTheDocument();
  });

  it('never renders a numeric confidence percentage', () => {
    const states = ['grounded', 'degraded', 'data-gap'] as const;
    states.forEach((state) => {
      const { unmount } = render(<RetrievalStateBadge state={state} />);
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
      unmount();
    });
  });
});
