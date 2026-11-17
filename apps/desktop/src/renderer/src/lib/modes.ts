import { Layers, RotateCcw, ToggleRight, type LucideIcon } from 'lucide-react'
import type { PlayMode } from '../../../shared/types'

export const PLAY_MODES: Record<PlayMode, { label: string; hint: string; icon: LucideIcon }> = {
  restart: {
    label: 'Restart',
    hint: 'Pressing again starts the sound over.',
    icon: RotateCcw
  },
  overlap: {
    label: 'Overlap',
    hint: 'Each press layers another copy on top.',
    icon: Layers
  },
  toggle: {
    label: 'Toggle',
    hint: 'The second press stops the sound.',
    icon: ToggleRight
  }
}
