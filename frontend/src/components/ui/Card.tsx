import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ className, padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-gray-200 shadow-sm',
        padding && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx('text-lg font-semibold text-gray-900', className)} {...props}>
      {children}
    </h3>
  );
}
