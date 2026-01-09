'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEUR } from '@/lib/utils'

interface BillItem {
  id: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
  totalClaimed?: number
  paidClaimed?: number
  unpaidQuantity?: number
  unclaimedQuantity?: number
}

interface BillItemsEditorProps {
  billId: string
  items: BillItem[]
  payerName: string
  ownerSelection?: {
    id: string
    itemQuantities: Record<string, number>
  } | null
}

export default function BillItemsEditor({ billId, items, payerName, ownerSelection }: BillItemsEditorProps) {
  const router = useRouter()
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    quantity: number
    pricePerUnit: number
  } | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    quantity: 1,
    pricePerUnit: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ownerQuantities, setOwnerQuantities] = useState<Record<string, number>>(
    ownerSelection?.itemQuantities || {}
  )
  const [selectingForMe, setSelectingForMe] = useState<string | null>(null)

  function startEdit(item: BillItem) {
    setEditingItemId(item.id)
    setEditForm({
      name: item.name,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit
    })
    setError('')
  }

  function cancelEdit() {
    setEditingItemId(null)
    setEditForm(null)
    setError('')
  }

  async function saveEdit(itemId: string) {
    if (!editForm) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/bill-items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      setEditingItemId(null)
      setEditForm(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Möchten Sie diese Position wirklich löschen?')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/bill-items/${itemId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  async function addNewItem() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/bill-items/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billId,
          ...newItemForm
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen')
      }

      setAddingNew(false)
      setNewItemForm({ name: '', quantity: 1, pricePerUnit: 0 })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  async function updateOwnerQuantity(itemId: string, quantity: number) {
    const newQuantities = { ...ownerQuantities }

    if (quantity === 0) {
      delete newQuantities[itemId]
    } else {
      newQuantities[itemId] = quantity
    }

    setOwnerQuantities(newQuantities)
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/selections/owner', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billId,
          itemQuantities: newQuantities,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setOwnerQuantities(ownerQuantities)
    } finally {
      setLoading(false)
      setSelectingForMe(null)
    }
  }

  function getOwnerQuantity(itemId: string): number {
    return ownerQuantities[itemId] || 0
  }

  const openItemsCount = items.filter(item =>
    (item.unclaimedQuantity || 0) > 0 || (item.unpaidQuantity || 0) > 0
  ).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-6 mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Positionen ({items.length})
        </h2>
        {openItemsCount > 0 && (
          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mt-1">
            {openItemsCount} {openItemsCount === 1 ? 'Position hat' : 'Positionen haben'} offene Beträge
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {items
          .sort((a, b) => {
            const aHasOpen = ((a.unclaimedQuantity || 0) > 0 || (a.unpaidQuantity || 0) > 0)
            const bHasOpen = ((b.unclaimedQuantity || 0) > 0 || (b.unpaidQuantity || 0) > 0)
            if (aHasOpen && !bHasOpen) return -1
            if (!aHasOpen && bHasOpen) return 1
            return 0
          })
          .map((item) => {
          const isEditing = editingItemId === item.id
          const hasSelections = (item.totalClaimed || 0) > 0
          const hasUnpaid = (item.unpaidQuantity || 0) > 0 || (item.unclaimedQuantity || 0) > 0
          const borderColor = hasUnpaid
            ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20'
            : 'border-gray-200 dark:border-gray-600 dark:bg-gray-700/50'

          return (
            <div
              key={item.id}
              className={`border rounded-lg p-4 ${borderColor}`}
            >
              {isEditing && editForm ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bezeichnung
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Anzahl
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Preis pro Einheit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.pricePerUnit}
                        onChange={(e) => setEditForm({ ...editForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Gesamtpreis: {formatEUR(editForm.quantity * editForm.pricePerUnit)}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => saveEdit(item.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? 'Speichern...' : 'Speichern'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={loading}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{item.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {item.quantity}x à {formatEUR(item.pricePerUnit)} = {formatEUR(item.totalPrice)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(item)}
                        disabled={hasSelections || loading}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 dark:disabled:bg-gray-700 dark:disabled:text-gray-500 text-blue-700 dark:text-blue-300 rounded text-sm font-medium transition-colors"
                        title={hasSelections ? 'Kann nicht bearbeitet werden: bereits bezahlt' : 'Bearbeiten'}
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={hasSelections || loading}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 dark:bg-red-900/30 dark:hover:bg-red-800/40 dark:disabled:bg-gray-700 dark:disabled:text-gray-500 text-red-700 dark:text-red-300 rounded text-sm font-medium transition-colors"
                        title={hasSelections ? 'Kann nicht gelöscht werden: bereits bezahlt' : 'Löschen'}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                  {hasSelections && (
                    <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Zahlung bestätigt:</span>
                          <span className="font-semibold text-green-600 dark:text-green-400 text-base">{item.paidClaimed || 0}x</span>
                        </div>
                        {(item.unpaidQuantity || 0) > 0 && (
                          <div className="flex justify-between items-center bg-yellow-100 dark:bg-yellow-900/30 -mx-4 px-4 py-2 rounded">
                            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Bezahlt, nicht bestätigt:</span>
                            <span className="font-bold text-yellow-700 dark:text-yellow-400 text-lg">{item.unpaidQuantity}x</span>
                          </div>
                        )}
                        {(item.unclaimedQuantity || 0) > 0 && (
                          <div className="flex justify-between items-center bg-red-100 dark:bg-red-900/30 -mx-4 px-4 py-2 rounded">
                            <span className="text-sm font-medium text-red-800 dark:text-red-300">Noch nicht bezahlt:</span>
                            <span className="font-bold text-red-700 dark:text-red-400 text-lg">{item.unclaimedQuantity}x</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Owner Selection - "Für mich" */}
                  <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-600">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Für mich ({payerName}):</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 text-base">
                        {getOwnerQuantity(item.id)}x
                      </span>
                    </div>

                    {selectingForMe === item.id ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 -mx-4 px-4 py-3 rounded">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <button
                            onClick={() => updateOwnerQuantity(item.id, 0)}
                            disabled={loading}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-sm font-medium transition-colors"
                          >
                            0x
                          </button>
                          {[0.5, 1, 2, 3].map((qty) => (
                            qty <= item.quantity && (
                              <button
                                key={qty}
                                onClick={() => updateOwnerQuantity(item.id, qty)}
                                disabled={loading}
                                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 dark:bg-blue-900/40 dark:hover:bg-blue-800/50 dark:disabled:bg-gray-700 text-blue-700 dark:text-blue-300 rounded text-sm font-medium transition-colors"
                              >
                                {qty}x
                              </button>
                            )
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={item.quantity}
                            placeholder="Andere Menge"
                            className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-100"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const value = parseFloat((e.target as HTMLInputElement).value)
                                if (!isNaN(value) && value >= 0 && value <= item.quantity) {
                                  updateOwnerQuantity(item.id, value)
                                }
                              }
                            }}
                          />
                          <button
                            onClick={() => setSelectingForMe(null)}
                            disabled={loading}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-sm font-medium transition-colors"
                          >
                            Fertig
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectingForMe(item.id)}
                        disabled={loading}
                        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
                      >
                        Menge auswählen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {addingNew ? (
            <div className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Neue Position hinzufügen</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bezeichnung
                  </label>
                  <input
                    type="text"
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Anzahl
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={newItemForm.quantity}
                      onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Preis pro Einheit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItemForm.pricePerUnit}
                      onChange={(e) => setNewItemForm({ ...newItemForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Gesamtpreis: {formatEUR(newItemForm.quantity * newItemForm.pricePerUnit)}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={addNewItem}
                    disabled={loading || !newItemForm.name.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {loading ? 'Hinzufügen...' : 'Hinzufügen'}
                  </button>
                  <button
                    onClick={() => {
                      setAddingNew(false)
                      setNewItemForm({ name: '', quantity: 1, pricePerUnit: 0 })
                      setError('')
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              + Neue Position hinzufügen
            </button>
          )}
      </div>
    </div>
  )
}
