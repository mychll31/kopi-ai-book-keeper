import Image from "next/image";

export default function KopiLogo() {
  return <span className="brand-icon kopi-logo"><Image src="/images/kopi-logo.png" alt="Kopi" width={72} height={72} sizes="40px" /></span>;
}
