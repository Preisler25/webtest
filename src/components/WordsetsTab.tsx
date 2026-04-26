import { useState, useRef, type ChangeEvent } from 'react'
import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.ts'
import type { Wordset, Word } from '../types.ts'

type Props = {
  user: User
  wordsets: Wordset[]
  onRefresh: () => Promise<void>
}

type WordDetail = Word & { editing?: boolean; editSource?: string; editTarget?: string }

export default function WordsetsTab({ user, wordsets, onRefresh }: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [words, setWords] = useState<WordDetail[]>([])
  const [wordsLoading, setWordsLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [sourceLang, setSourceLang] = useState('hu')
  const [targetLang, setTargetLang] = useState('en')
  const [isPublic, setIsPublic] = useState(false)
  const [creating, setCreating] = useState(false)

  const [sourceWord, setSourceWord] = useState('')
  const [targetWord, setTargetWord] = useState('')
  const [addingWord, setAddingWord] = useState(false)

  const [message, setMessage] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [txtCreateLoading, setTxtCreateLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const txtCreateInputRef = useRef<HTMLInputElement>(null)

  const ownWordsets = wordsets.filter((ws) => ws.userId === user.uid)
  const filtered = ownWordsets.filter((ws) =>
    ws.title.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedWordset = wordsets.find((ws) => ws.id === selectedId) ?? null

  async function loadWords(wordsetId: string) {
    setWordsLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'wordsets', wordsetId, 'words'), orderBy('source')),
      )
      setWords(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Word, 'id'>) })))
    } catch (err) {
      console.error('[loadWords]', err)
    } finally {
      setWordsLoading(false)
    }
  }

  function selectWordset(id: string) {
    setSelectedId(id)
    setWords([])
    void loadWords(id)
  }

  async function createWordset() {
    if (!title.trim()) { setMessage('Adj nevet a szókészletnek.'); return }
    setCreating(true)
    try {
      await addDoc(collection(db, 'wordsets'), {
        userId: user.uid,
        title: title.trim(),
        isPublic,
        sourceLang: sourceLang.trim().toLowerCase(),
        targetLang: targetLang.trim().toLowerCase(),
        wordCount: 0,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setMessage('Szókészlet létrehozva.')
      await onRefresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hiba')
    } finally {
      setCreating(false)
    }
  }

  async function addWord() {
    if (!selectedId) return
    if (!sourceWord.trim() || !targetWord.trim()) { setMessage('Töltsd ki mindkét mezőt.'); return }
    setAddingWord(true)
    try {
      await addDoc(collection(db, 'wordsets', selectedId, 'words'), {
        source: sourceWord.trim(),
        target: targetWord.trim(),
        mastered: false,
      })
      await updateDoc(doc(db, 'wordsets', selectedId), { wordCount: increment(1) })
      setSourceWord('')
      setTargetWord('')
      await loadWords(selectedId)
      await onRefresh()
      setMessage('Szó hozzáadva.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hiba')
    } finally {
      setAddingWord(false)
    }
  }

  async function deleteWord(wordId: string) {
    if (!selectedId) return
    try {
      await deleteDoc(doc(db, 'wordsets', selectedId, 'words', wordId))
      await updateDoc(doc(db, 'wordsets', selectedId), { wordCount: increment(-1) })
      setWords((ws) => ws.filter((w) => w.id !== wordId))
      await onRefresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hiba')
    }
  }

  function startEdit(wordId: string) {
    setWords((ws) =>
      ws.map((w) =>
        w.id === wordId
          ? { ...w, editing: true, editSource: w.source, editTarget: w.target }
          : w,
      ),
    )
  }

  async function saveEdit(wordId: string) {
    if (!selectedId) return
    const word = words.find((w) => w.id === wordId)
    if (!word) return
    try {
      await updateDoc(doc(db, 'wordsets', selectedId, 'words', wordId), {
        source: word.editSource?.trim() ?? word.source,
        target: word.editTarget?.trim() ?? word.target,
      })
      setWords((ws) =>
        ws.map((w) =>
          w.id === wordId
            ? { ...w, source: w.editSource ?? w.source, target: w.editTarget ?? w.target, editing: false }
            : w,
        ),
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hiba')
    }
  }

  function cancelEdit(wordId: string) {
    setWords((ws) => ws.map((w) => (w.id === wordId ? { ...w, editing: false } : w)))
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    if (!selectedId || !e.target.files?.[0]) return
    const file = e.target.files[0]
    e.target.value = ''
    setImportLoading(true)
    setMessage('')
    try {
      const text = await file.text()
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes(':'))

      const pairs = lines.map((l) => {
        const colon = l.indexOf(':')
        return { source: l.slice(0, colon).trim(), target: l.slice(colon + 1).trim() }
      }).filter((p) => p.source && p.target)

      if (pairs.length === 0) { setMessage('Nem találtam érvényes sorokat (formátum: forrás:cél)'); return }

      const CHUNK = 500
      for (let i = 0; i < pairs.length; i += CHUNK) {
        const batch = writeBatch(db)
        pairs.slice(i, i + CHUNK).forEach((p) => {
          batch.set(doc(collection(db, 'wordsets', selectedId, 'words')), {
            source: p.source,
            target: p.target,
            mastered: false,
          })
        })
        await batch.commit()
      }

      await updateDoc(doc(db, 'wordsets', selectedId), { wordCount: increment(pairs.length) })
      await loadWords(selectedId)
      await onRefresh()
      setMessage(`${pairs.length} szó importálva.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import hiba')
    } finally {
      setImportLoading(false)
    }
  }

  function parseWordsetFilename(filename: string) {
    const name = filename.replace(/\.txt$/i, '')
    const parts = name.split('_')
    if (parts.length < 4) return null
    const visibility = parts[parts.length - 1].toLowerCase()
    if (visibility !== 'pu' && visibility !== 'pr') return null
    const targetLang = parts[parts.length - 2].toLowerCase()
    const sourceLang = parts[parts.length - 3].toLowerCase()
    const title = parts.slice(0, -3).join(' ')
    if (!title.trim() || !sourceLang || !targetLang) return null
    return { title: title.trim(), sourceLang, targetLang, isPublic: visibility === 'pu' }
  }

  async function handleTxtCreate(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''
    setTxtCreateLoading(true)
    setMessage('')
    const results: string[] = []
    try {
      for (const file of files) {
        const meta = parseWordsetFilename(file.name)
        if (!meta) {
          results.push(`❌ ${file.name}: helytelen fájlnév`)
          continue
        }

        const text = await file.text()
        const pairs = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.includes(':'))
          .map((l) => { const c = l.indexOf(':'); return { source: l.slice(0, c).trim(), target: l.slice(c + 1).trim() } })
          .filter((p) => p.source && p.target)

        if (pairs.length === 0) {
          results.push(`❌ ${file.name}: nem találtam szavakat`)
          continue
        }

        const wsRef = await addDoc(collection(db, 'wordsets'), {
          userId: user.uid,
          title: meta.title,
          isPublic: meta.isPublic,
          sourceLang: meta.sourceLang,
          targetLang: meta.targetLang,
          wordCount: pairs.length,
          createdAt: serverTimestamp(),
        })

        const CHUNK = 500
        for (let i = 0; i < pairs.length; i += CHUNK) {
          const batch = writeBatch(db)
          pairs.slice(i, i + CHUNK).forEach((p) => {
            batch.set(doc(collection(db, 'wordsets', wsRef.id, 'words')), {
              source: p.source,
              target: p.target,
              mastered: false,
            })
          })
          await batch.commit()
        }

        results.push(`✅ "${meta.title}" – ${pairs.length} szó`)
      }

      await onRefresh()
      setMessage(results.join('\n'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hiba')
    } finally {
      setTxtCreateLoading(false)
    }
  }

  async function deleteWordset(id: string) {
    if (!window.confirm('Biztosan törlöd ezt a szókészletet?')) return
    try {
      await deleteDoc(doc(db, 'wordsets', id))
      if (selectedId === id) setSelectedId(null)
      await onRefresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hiba')
    }
  }

  return (
    <div className="tab-page">
      <header className="page-header">
        <h2>Szókészletek</h2>
      </header>

      {message && (
        <p className="status-toast" onClick={() => setMessage('')}>{message}</p>
      )}

      {!selectedId ? (
        <div className="scroll-column">
          {/* Create form */}
          <section className="card">
            <p className="eyebrow">Új szókészlet</p>
            <label>
              Cím
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pl. Mindennapi kifejezések" />
            </label>
            <div className="inline-inputs">
              <label>Forrás<input value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} placeholder="hu" /></label>
              <label>Cél<input value={targetLang} onChange={(e) => setTargetLang(e.target.value)} placeholder="en" /></label>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Nyilvános szókészlet
            </label>
            <button className="btn-primary" onClick={createWordset} disabled={creating}>
              {creating ? 'Létrehozás...' : 'Létrehozás'}
            </button>
          </section>

          {/* Create from txt */}
          <section className="card">
            <p className="eyebrow">Létrehozás .txt fájlból</p>
            <p className="muted" style={{ fontSize: '0.8rem' }}>
              Fájlnév: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.35rem', borderRadius: '0.35rem' }}>Cím_forrás_cél_pu.txt</code> (pu = nyilvános, pr = privát)
            </p>
            <p className="muted" style={{ fontSize: '0.8rem' }}>Tartalom: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.35rem', borderRadius: '0.35rem' }}>forrásszó:célszó</code> (soronként)</p>
            <input
              ref={txtCreateInputRef}
              type="file"
              accept=".txt"
              multiple
              style={{ display: 'none' }}
              onChange={handleTxtCreate}
            />
            <button
              className="btn-secondary"
              onClick={() => txtCreateInputRef.current?.click()}
              disabled={txtCreateLoading}
            >
              {txtCreateLoading ? 'Importálás...' : '⬆ Szókészlet feltöltése .txt-ből'}
            </button>
          </section>

          {/* Search + list */}
          <div className="search-row">
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍  Keresés..."
            />
          </div>

          {filtered.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
              {search ? 'Nincs találat.' : 'Még nincs szókészleted.'}
            </p>
          ) : (
            <ul className="wordset-cards">
              {filtered.map((ws) => (
                <li key={ws.id} className="wordset-card-item">
                  <button className="wordset-card-btn" onClick={() => selectWordset(ws.id)}>
                    <div className="wordset-card-info">
                      <strong>{ws.title}</strong>
                      <span className="lang-badge">{ws.sourceLang.toUpperCase()} → {ws.targetLang.toUpperCase()}</span>
                    </div>
                    <div className="wordset-card-meta">
                      <span>{ws.wordCount} szó</span>
                      {ws.isPublic && <span className="public-badge">Nyilvános</span>}
                    </div>
                  </button>
                  <button className="icon-btn danger" onClick={() => deleteWordset(ws.id)} title="Törlés">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="scroll-column">
          <div className="detail-header">
            <button className="btn-ghost back-btn" onClick={() => setSelectedId(null)}>← Vissza</button>
            <h3>{selectedWordset?.title}</h3>
            <span className="lang-badge">{selectedWordset?.sourceLang.toUpperCase()} → {selectedWordset?.targetLang.toUpperCase()}</span>
          </div>

          {/* Add word form */}
          <section className="card">
            <p className="eyebrow">Szó hozzáadása</p>
            <div className="inline-inputs">
              <label>
                Forrás
                <input value={sourceWord} onChange={(e) => setSourceWord(e.target.value)} placeholder="Szia" />
              </label>
              <label>
                Cél
                <input value={targetWord} onChange={(e) => setTargetWord(e.target.value)} placeholder="Hello"
                  onKeyDown={(e) => { if (e.key === 'Enter') void addWord() }} />
              </label>
            </div>
            <div className="btn-row">
              <button className="btn-primary" onClick={addWord} disabled={addingWord}>
                {addingWord ? '...' : '+ Hozzáadás'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
              <button
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading}
              >
                {importLoading ? 'Importálás...' : '⬆ Importálás .txt-ből'}
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.74rem' }}>
              Txt formátum: forrásszó:célszó (soronként egy szó)
            </p>
          </section>

          {/* Word list */}
          {wordsLoading ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>Betöltés...</p>
          ) : words.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>Még nincs szó ebben a készletben.</p>
          ) : (
            <ul className="word-list">
              {words.map((w) => (
                <li key={w.id} className="word-item">
                  {w.editing ? (
                    <div className="word-edit-row">
                      <input
                        value={w.editSource ?? ''}
                        onChange={(e) => setWords((ws) => ws.map((x) => x.id === w.id ? { ...x, editSource: e.target.value } : x))}
                      />
                      <span className="word-arrow">→</span>
                      <input
                        value={w.editTarget ?? ''}
                        onChange={(e) => setWords((ws) => ws.map((x) => x.id === w.id ? { ...x, editTarget: e.target.value } : x))}
                      />
                      <button className="icon-btn mint" onClick={() => saveEdit(w.id)}>✓</button>
                      <button className="icon-btn" onClick={() => cancelEdit(w.id)}>✕</button>
                    </div>
                  ) : (
                    <div className="word-row">
                      <span className="word-source">{w.source}</span>
                      <span className="word-arrow">→</span>
                      <span className="word-target">{w.target}</span>
                      {w.mastered && <span className="mastered-dot" title="Elsajátítva">●</span>}
                      <div className="word-actions">
                        <button className="icon-btn" onClick={() => startEdit(w.id)} title="Szerkesztés">✎</button>
                        <button className="icon-btn danger" onClick={() => deleteWord(w.id)} title="Törlés">✕</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
