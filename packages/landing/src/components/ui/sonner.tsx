import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white/95 dark:group-[.toaster]:bg-gray-900/95 group-[.toaster]:text-gray-900 dark:group-[.toaster]:text-gray-100 group-[.toaster]:border-gray-200 dark:group-[.toaster]:border-gray-700/50 group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-sm',
          description: 'group-[.toast]:text-gray-600 dark:group-[.toast]:text-gray-400',
          actionButton:
            'group-[.toast]:bg-blue-600 group-[.toast]:text-white hover:group-[.toast]:bg-blue-700',
          cancelButton:
            'group-[.toast]:bg-gray-100 dark:group-[.toast]:bg-gray-800 group-[.toast]:text-gray-700 dark:group-[.toast]:text-gray-300',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };