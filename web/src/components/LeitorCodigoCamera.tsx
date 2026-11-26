import { useEffect, useRef, useState } from 'react'
import { Button, Dialog } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  /** Chamado uma vez com o código lido; a janela fecha em seguida. */
  onDetectado: (codigo: string) => void
}

type Parar = () => void

/** Formatos de produto no varejo (EAN/UPC) + Code 128, usado em etiquetas internas. */
const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

type BarcodeDetectorLike = {
  detect: (fonte: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

function mensagemErroCamera(err: unknown): string {
  const nome = (err as { name?: string })?.name ?? ''
  if (!window.isSecureContext) return 'A câmera só funciona com o sistema aberto em https (ex.: agilizapdv.app).'
  if (nome === 'NotAllowedError' || nome === 'SecurityError')
    return 'Permita o acesso à câmera nas configurações do navegador e tente de novo.'
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Nenhuma câmera encontrada neste aparelho.'
  if (nome === 'NotReadableError') return 'A câmera está em uso por outro aplicativo. Feche-o e tente de novo.'
  return 'Não foi possível abrir a câmera.'
}

/** Leitura com o leitor nativo do navegador (Chrome no Android). */
async function iniciarNativo(video: HTMLVideoElement, aoLer: (c: string) => void): Promise<Parar | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  const suportados = (await Ctor.getSupportedFormats?.().catch(() => [])) ?? []
  const formatos = FORMATOS_NATIVOS.filter((f) => suportados.includes(f))
  if (!formatos.includes('ean_13')) return null

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
  const detector = new Ctor({ formats: formatos })
  let ativo = true
  const loop = async () => {
    if (!ativo) return
    try {
      const achados = await detector.detect(video)
      const codigo = achados.find((a) => a.rawValue?.trim())?.rawValue.trim()
      if (codigo) {
        ativo = false
        aoLer(codigo)
        return
      }
    } catch {
      // quadro sem leitura: segue tentando
    }
    if (ativo) window.setTimeout(loop, 200)
  }
  void loop()
  return () => {
    ativo = false
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }
}

/** Leitura com @zxing (Safari/iPhone e navegadores sem leitor nativo). Carregada só quando precisa. */
async function iniciarZxing(video: HTMLVideoElement, aoLer: (c: string) => void): Promise<Parar> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ])
  const leitor = new BrowserMultiFormatReader(hints)
  let lido = false
  const controles = await leitor.decodeFromConstraints(
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    video,
    (resultado) => {
      if (!resultado || lido) return
      const codigo = resultado.getText().trim()
      if (!codigo) return
      lido = true
      aoLer(codigo)
    }
  )
  return () => controles.stop()
}

export function LeitorCodigoCamera({ open, onClose, onDetectado }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const onDetectadoRef = useRef(onDetectado)
  onDetectadoRef.current = onDetectado

  useEffect(() => {
    if (!open) return
    const video = videoRef.current
    if (!video) return
    let parar: Parar | null = null
    let cancelado = false
    setErro(null)
    setIniciando(true)

    const aoLer = (codigo: string) => {
      if (cancelado) return
      cancelado = true
      navigator.vibrate?.(80)
      parar?.()
      onDetectadoRef.current(codigo)
    }

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('sem câmera'), { name: 'NotFoundError' })
        parar = (await iniciarNativo(video, aoLer)) ?? (await iniciarZxing(video, aoLer))
        if (cancelado) parar()
      } catch (e) {
        if (!cancelado) setErro(mensagemErroCamera(e))
      } finally {
        if (!cancelado) setIniciando(false)
      }
    })()

    return () => {
      cancelado = true
      parar?.()
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ler código de barras"
      footer={
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <div className="leitor-camera">
        <div className="leitor-camera__video-wrap">
          <video ref={videoRef} className="leitor-camera__video" muted playsInline autoPlay />
          {!erro && <div className="leitor-camera__mira" aria-hidden="true" />}
          {iniciando && !erro && <span className="leitor-camera__status">Abrindo a câmera...</span>}
        </div>
        {erro ? (
          <p className="leitor-camera__erro" role="alert">
            {erro}
          </p>
        ) : (
          <p className="leitor-camera__ajuda">Aponte a câmera para o código de barras do produto, dentro da faixa.</p>
        )}
      </div>
    </Dialog>
  )
}
