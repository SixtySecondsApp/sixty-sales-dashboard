import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-blue-600 dark:bg-blue-500/10 text-white dark:text-blue-400 border border-blue-600 dark:border-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-500/20 hover:border-blue-700 dark:hover:border-blue-500/30 shadow-sm dark:shadow-none focus-visible:ring-blue-500',
        destructive:
          'bg-red-600 dark:bg-red-600/10 text-white dark:text-red-400 border border-red-600 dark:border-red-600/20 hover:bg-red-700 dark:hover:bg-red-600/20 hover:border-red-700 dark:hover:border-red-600/30 shadow-sm dark:shadow-none focus-visible:ring-red-500',
        outline:
          'bg-white dark:bg-gray-700/10 text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600/20 hover:bg-gray-50 dark:hover:bg-gray-700/20 hover:border-gray-400 dark:hover:border-gray-500/30 shadow-sm dark:shadow-none focus-visible:ring-gray-500',
        secondary:
          'bg-white dark:bg-gray-600/10 text-gray-900 dark:text-gray-400 border border-gray-300 dark:border-gray-500/20 hover:bg-gray-50 dark:hover:bg-gray-600/20 hover:border-gray-400 dark:hover:border-gray-500/30 shadow-sm dark:shadow-none focus-visible:ring-gray-500',
        tertiary:
          'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50 focus-visible:ring-gray-500',
        success:
          'bg-emerald-600 dark:bg-emerald-500/10 text-white dark:text-emerald-400 border border-emerald-600 dark:border-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-500/20 hover:border-emerald-700 dark:hover:border-emerald-500/30 shadow-sm dark:shadow-none focus-visible:ring-emerald-500',
        danger:
          'bg-red-600 dark:bg-red-500/10 text-white dark:text-red-400 border border-red-600 dark:border-red-500/20 hover:bg-red-700 dark:hover:bg-red-500/20 hover:border-red-700 dark:hover:border-red-500/30 shadow-sm dark:shadow-none focus-visible:ring-red-500',
        ghost:
          'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 hover:text-gray-900 dark:hover:text-white focus-visible:ring-gray-500',
        link: 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline underline-offset-4',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };