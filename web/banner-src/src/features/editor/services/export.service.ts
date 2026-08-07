import type { ExportOptions } from '@/core/types/banner.types'
import { downloadBlob } from '@/core/utils/helpers'
import { canvasEngine } from './canvas.engine'

export class ExportService {
  exportBannerDataUrl(options: ExportOptions): string {
    return canvasEngine.exportToDataURL({
      format: options.format,
      multiplier: options.multiplier,
      quality: options.quality,
    })
  }

  async exportBanner(
    projectName: string,
    options: ExportOptions,
  ): Promise<void> {
    const dataUrl = this.exportBannerDataUrl(options)

    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const safeName = projectName.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'banner'

    downloadBlob(blob, `${safeName}.${options.format}`)
  }
}

export const exportService = new ExportService()
