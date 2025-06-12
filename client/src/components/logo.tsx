import { QrCode } from 'lucide-react';

interface LogoProps {
  className?: string;
  showFallback?: boolean;
}

export default function Logo({ className = "w-12 h-12", showFallback = true }: LogoProps) {
  // You can replace this path with your actual logo file
  // Place your logo in the public folder and reference it like: "/logo.png"
  const logoPath = "/logo.png";
  
  return (
    <div className={`${className} rounded-2xl bg-primary/20 flex items-center justify-center overflow-hidden`}>
      <img
        src={logoPath}
        alt="Company Logo"
        className="w-full h-full object-contain"
        onError={(e) => {
          // If logo fails to load and fallback is enabled, show QR icon
          if (showFallback) {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent && !parent.querySelector('.fallback-icon')) {
              const icon = document.createElement('div');
              icon.className = 'fallback-icon text-primary text-xl';
              icon.innerHTML = '<svg class="lucide lucide-qr-code" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="m21 16-3.5-3.5-1 1"/><path d="m21 21-2-2"/><path d="m21 21-1-1"/><path d="M14 7h1v1"/><path d="M10 7h1v1"/><path d="M7 10h1v1"/><path d="M14 14h1v1"/></svg>';
              parent.appendChild(icon);
            }
          }
        }}
      />
      {/* Fallback icon rendered by React if needed */}
      <QrCode className="text-primary text-xl hidden" />
    </div>
  );
}