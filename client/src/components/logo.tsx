interface LogoProps {
  className?: string;
}

export default function Logo({ className = "w-20 h-20" }: LogoProps) {
  const logoUrl = "https://www.growthsphereindustries.com/assets/img/logo/zatscan-color.png";
  
  return (
    <div className={`${className} flex items-center justify-center`}>
      <img
        src={logoUrl}
        alt="ZatScan Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
}