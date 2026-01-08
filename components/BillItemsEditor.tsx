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
}

export default function BillItemsEditor({ billId, items }: BillItemsEditorProps) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Positionen ({items.length})
        </h2>
        <button
          onClick={() => setEditMode(!editMode)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {editMode ? 'Fertig' : 'Bearbeiten'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const isEditing = editingItemId === item.id
          const hasSelections = (item.totalClaimed || 0) > 0
          const hasUnpaid = (item.unpaidQuantity || 0) > 0 || (item.unclaimedQuantity || 0) > 0
          const borderColor = hasUnpaid ? 'border-orange-300 bg-orange-50' : 'border-gray-200'

          return (
            <div
              key={item.id}
              className={`border rounded-lg p-4 ${borderColor}`}
            >
              {isEditing && editForm ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bezeichnung
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Anzahl
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preis pro Einheit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.pricePerUnit}
                        onChange={(e) => setEditForm({ ...editForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Gesamtpreis: {formatEUR(editForm.quantity * editForm.pricePerUnit)}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => saveEdit(item.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? 'Speichern...' : 'Speichern'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={loading}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600">
                        {item.quantity}x à {formatEUR(item.pricePerUnit)} = {formatEUR(item.totalPrice)}
                      </p>
                    </div>
                    {editMode && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(item)}
                          disabled={hasSelections || loading}
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 text-blue-700 rounded text-sm font-medium transition-colors"
                          title={hasSelections ? 'Kann nicht bearbeitet werden: bereits ausgewählt' : 'Bearbeiten'}
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={hasSelections || loading}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 text-red-700 rounded text-sm font-medium transition-colors"
                          title={hasSelections ? 'Kann nicht gelöscht werden: bereits ausgewählt' : 'Löschen'}
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </div>
                  {hasSelections && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bezahlt:</span>
                          <span className="font-medium text-green-600">{item.paidClaimed || 0}x</span>
                        </div>
                        {(item.unpaidQuantity || 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Nicht bezahlt:</span>
                            <span className="font-medium text-yellow-600">{item.unpaidQuantity}x</span>
                          </div>
                        )}
                        {(item.unclaimedQuantity || 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Noch offen:</span>
                            <span className="font-medium text-red-600">{item.unclaimedQuantity}x</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {editMode && (
          addingNew ? (
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
              <h3 className="font-medium text-gray-900 mb-3">Neue Position hinzufügen</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bezeichnung
                  </label>
                  <input
                    type="text"
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Anzahl
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={newItemForm.quantity}
                      onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preis pro Einheit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItemForm.pricePerUnit}
                      onChange={(e) => setNewItemForm({ ...newItemForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Gesamtpreis: {formatEUR(newItemForm.quantity * newItemForm.pricePerUnit)}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={addNewItem}
                    disabled={loading || !newItemForm.name.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
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
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + Neue Position hinzufügen
            </button>
          )
        )}
      </div>
    </div>
  )
}
