export function Footer() {
  return (
    <footer className="bg-surface-container-lowest py-20 px-6 md:px-10 border-t border-outline-variant/15">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
        <div className="col-span-1">
          <div className="text-xl font-black bg-primary text-on-primary px-3 py-1 font-[family-name:var(--font-plus-jakarta)] tracking-tight uppercase inline-block mb-8">
            TalentChain
          </div>
          <p className="text-on-surface-variant text-sm font-[family-name:var(--font-manrope)] leading-relaxed">
            Elevando el estándar del capital humano mediante tecnología de cadena de bloques y verificación institucional.
          </p>
        </div>

        <div>
          <h6 className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-widest text-xs mb-8 text-primary">
            Plataforma
          </h6>
          <ul className="space-y-4 font-[family-name:var(--font-manrope)] text-sm text-on-surface-variant">
            <li><a className="hover:text-primary transition-colors" href="#">Talent Explore</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Certificados NFT</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Proyectos Escrow</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Security Audit</a></li>
          </ul>
        </div>

        <div>
          <h6 className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-widest text-xs mb-8 text-primary">
            Compañía
          </h6>
          <ul className="space-y-4 font-[family-name:var(--font-manrope)] text-sm text-on-surface-variant">
            <li><a className="hover:text-primary transition-colors" href="#">Manifiesto</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Partnerships</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Media Kit</a></li>
            <li><a className="hover:text-primary transition-colors" href="/auth/register">Únete</a></li>
          </ul>
        </div>

        <div>
          <h6 className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-widest text-xs mb-8 text-primary">
            Newsletter
          </h6>
          <p className="text-on-surface-variant text-sm font-[family-name:var(--font-manrope)] mb-6">
            Recibe actualizaciones sobre lanzamientos de tokens exclusivos.
          </p>
          <div className="relative">
            <input
              type="email"
              placeholder="email@talentchain.io"
              className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm py-3 transition-colors text-on-surface placeholder:text-on-surface-variant/50 outline-none"
            />
            <button className="absolute right-0 top-1/2 -translate-y-1/2 text-primary hover:text-primary-fixed-dim transition-colors">
              →
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-outline-variant/10 text-[10px] text-on-surface-variant font-bold tracking-[0.2em] uppercase font-[family-name:var(--font-plus-jakarta)]">
        <p>© {new Date().getFullYear()} TALENTCHAIN PROTOCOL. ALL RIGHTS RESERVED.</p>
        <div className="flex gap-8 mt-4 md:mt-0">
          <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
