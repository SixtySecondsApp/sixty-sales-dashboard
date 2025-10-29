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
          'bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/30 focus-visible:ring-blue-500 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/20',
        destructive:
          'bg-red-600/10 border border-red-600/20 text-red-400 font-medium hover:bg-red-600/20 hover:text-red-300 hover:border-red-600/30 focus-visible:ring-red-500 dark:bg-red-600/10 dark:border-red-600/20 dark:text-red-400 dark:hover:bg-red-600/20',
        outline:
          'bg-gray-700/10 border border-gray-600/20 text-gray-300 font-medium hover:bg-gray-700/20 hover:text-gray-100 hover:border-gray-500/30 focus-visible:ring-gray-500 dark:bg-gray-700/10 dark:border-gray-600/20 dark:text-gray-300 dark:hover:bg-gray-700/20 dark:hover:text-gray-100',
        secondary:
          'bg-gray-600/10 border border-gray-500/20 text-gray-400 font-medium hover:bg-gray-600/20 hover:text-gray-200 hover:border-gray-500/30 focus-visible:ring-gray-500 dark:bg-gray-600/10 dark:border-gray-500/20 dark:text-gray-400 dark:hover:bg-gray-600/20 dark:hover:text-gray-200',
        tertiary:
          'bg-gray-800/50 border border-gray-700/50 text-gray-400 font-medium hover:bg-gray-700/50 hover:text-white hover:border-gray-600/50 focus-visible:ring-gray-500 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-white',
        success:
          'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 focus-visible:ring-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
        danger:
          'bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 focus-visible:ring-red-500 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/20',
        ghost:
          'bg-transparent border border-transparent text-gray-300 hover:bg-gray-800/30 hover:text-white focus-visible:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800/30 dark:hover:text-white',
        link: 'bg-transparent border-none text-blue-400 underline-offset-4 hover:underline hover:text-blue-300 dark:text-blue-400 dark:hover:text-blue-300',
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