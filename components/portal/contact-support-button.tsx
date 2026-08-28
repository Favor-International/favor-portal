'use client';

// Contact support = open the partner's email client. That is it.
//
// Will, 2026-08-06: "When I press Contact support, it still just pops up with a
// fake support instead of just taking me to email somebody, which is what I
// asked for." A ticket form implies a queue with an SLA behind it; there is no
// such queue. Mail originally went to tech@favorintl.org while Daniel Casella
// owned that box. He left August 2026; 2026-08-28 Blandford mail proved the
// address still hit him. Destination is will@favorintl.org.
//
// The subject and body are prefilled with who they are, so the team can find
// their record without asking.

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

const SUPPORT_EMAIL = 'will@favorintl.org';

interface ContactSupportButtonProps {
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
}

export function ContactSupportButton({
  label = 'Email our team',
  variant = 'default',
  size = 'default',
  className,
}: ContactSupportButtonProps) {
  const { user } = useAuth();

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const subject = encodeURIComponent('Partner portal support');
  const body = encodeURIComponent(
    [
      'How can we help?',
      '',
      '',
      '---',
      name ? `Partner: ${name}` : '',
      user?.email ? `Account: ${user.email}` : '',
      'Sent from the Favor Partner Portal',
    ]
      .filter(Boolean)
      .join('\n')
  );

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}>
        <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}
