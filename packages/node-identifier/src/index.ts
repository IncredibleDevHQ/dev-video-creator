// Copyright 2026 Karthic Rao
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, Transaction } from '@tiptap/pm/state'

export const renderableNodeTypes = [
  'paragraph',
  'blockquote',
  'heading',
  'bulletList',
  'orderedList',
  'codeBlock',
  'video',
  'image',
  'interaction',
]

export interface NodeIdentifierContext {
  node: ProseMirrorNode
  pos: number
}

export interface NodeIdentifierOptions {
  attributeName: string
  types: string[]
  filterTransaction: ((transaction: Transaction) => boolean) | null
  generateID: (context: NodeIdentifierContext) => string
  updateDocument: boolean
}

const nodeIdentifierPluginKey = new PluginKey('incredibleNodeIdentifier')

const fallbackIdentifier = () =>
  `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const generateIdentifier = () => {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return fallbackIdentifier()
}

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const createUnusedIdentifier = ({
  generateID,
  node,
  pos,
  usedIdentifiers,
}: {
  generateID: NodeIdentifierOptions['generateID']
  node: ProseMirrorNode
  pos: number
  usedIdentifiers: Set<string>
}) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const identifier = generateID({ node, pos })
    if (isIdentifier(identifier) && !usedIdentifiers.has(identifier)) {
      return identifier
    }
  }

  throw new Error('Node identifier generator did not produce a unique ID')
}

export const appendNodeIdentifierUpdates = ({
  doc,
  transaction,
  options,
}: {
  doc: ProseMirrorNode
  transaction: Transaction
  options: NodeIdentifierOptions
}) => {
  const addressableTypes = new Set(options.types)
  const usedIdentifiers = new Set<string>()

  doc.descendants((node, pos) => {
    if (!addressableTypes.has(node.type.name)) return

    const currentIdentifier = node.attrs[options.attributeName] as unknown
    if (
      isIdentifier(currentIdentifier) &&
      !usedIdentifiers.has(currentIdentifier)
    ) {
      usedIdentifiers.add(currentIdentifier)
      return
    }

    const identifier = createUnusedIdentifier({
      generateID: options.generateID,
      node,
      pos,
      usedIdentifiers,
    })
    usedIdentifiers.add(identifier)
    transaction.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      [options.attributeName]: identifier,
    })
  })

  return transaction
}

const NodeIdentifier = Extension.create<NodeIdentifierOptions>({
  name: 'incredibleNodeIdentifier',
  priority: 10_000,

  addOptions() {
    return {
      attributeName: 'id',
      types: renderableNodeTypes,
      filterTransaction: null,
      generateID: generateIdentifier,
      updateDocument: true,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: element =>
              element.getAttribute(this.options.attributeName),
            renderHTML: attributes => {
              const identifier = attributes[this.options.attributeName]
              return isIdentifier(identifier)
                ? { [this.options.attributeName]: identifier }
                : {}
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    if (!this.options.updateDocument) return []

    return [
      new Plugin({
        key: nodeIdentifierPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          const shouldInspect = transactions.some(transaction => {
            if (transaction.getMeta(nodeIdentifierPluginKey) === 'normalize') {
              return true
            }
            if (!transaction.docChanged) return false
            return this.options.filterTransaction
              ? this.options.filterTransaction(transaction)
              : true
          })

          if (!shouldInspect) return null

          const transaction = appendNodeIdentifierUpdates({
            doc: newState.doc,
            transaction: newState.tr,
            options: this.options,
          })

          return transaction.docChanged ? transaction : null
        },
        view: view => {
          queueMicrotask(() => {
            if (!view.isDestroyed) {
              view.dispatch(
                view.state.tr.setMeta(nodeIdentifierPluginKey, 'normalize'),
              )
            }
          })

          return {}
        },
      }),
    ]
  },
})

export default NodeIdentifier
