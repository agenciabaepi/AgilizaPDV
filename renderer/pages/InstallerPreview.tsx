import { Monitor, Server, HardDriveDownload } from 'lucide-react'
import logoAgiliza from '../../SVG/logo.svg'

export function InstallerPreview() {
  return (
    <div className="installer-preview-page">
      <div className="installer-preview-shell">
        <div className="installer-preview-window">
          <section className="installer-preview-main">
            <header className="installer-preview-header">
              <img
                src={logoAgiliza}
                alt="Agiliza PDV"
                className="installer-preview-header-logo"
              />
            </header>

            <div className="installer-preview-content">
              <h1>Escolha o modo de instalação</h1>
              <p>
                Este preview mostra como o instalador do Windows ficará com a nova identidade visual.
              </p>

              <div className="installer-preview-options">
                <button type="button" className="installer-preview-option installer-preview-option--active">
                  <Server size={18} />
                  <div>
                    <strong>Servidor</strong>
                    <span>PostgreSQL + API local + app</span>
                  </div>
                </button>

                <button type="button" className="installer-preview-option">
                  <Monitor size={18} />
                  <div>
                    <strong>Terminal</strong>
                    <span>Somente aplicativo PDV</span>
                  </div>
                </button>
              </div>

              <div className="installer-preview-status">
                <HardDriveDownload size={16} />
                Instalação estimada em 1-2 minutos
              </div>
            </div>

            <footer className="installer-preview-footer">
              <button type="button" className="btn btn--secondary btn--sm">Voltar</button>
              <button type="button" className="btn btn--secondary btn--sm">Cancelar</button>
              <button type="button" className="btn btn--primary btn--sm">Instalar</button>
            </footer>
          </section>
        </div>
      </div>
    </div>
  )
}
