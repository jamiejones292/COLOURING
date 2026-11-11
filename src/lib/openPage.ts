import { findProjectForPage, type Project } from './storage';
import { navigate } from './router';

/** Opens a preset page — or asks whether to continue an existing one. */
export async function openPage(pageId: string, ask: (p: Project) => void) {
  try {
    const existing = await findProjectForPage(pageId);
    if (existing && existing.colorLayer) {
      ask(existing);
      return;
    }
  } catch {
    /* storage unavailable — just open fresh */
  }
  navigate(`/color/${pageId}`);
}
