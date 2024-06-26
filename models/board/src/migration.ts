//
// Copyright © 2022 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { type Card, boardId } from '@hcengineering/board'
import { TxOperations } from '@hcengineering/core'
import {
  type MigrateOperation,
  type MigrationClient,
  type MigrationUpgradeClient,
  createOrUpdate,
  tryMigrate,
  tryUpgrade
} from '@hcengineering/model'
import core from '@hcengineering/model-core'
import { DOMAIN_TASK, createSequence } from '@hcengineering/model-task'
import tags from '@hcengineering/tags'
import board from './plugin'

async function createSpace (tx: TxOperations): Promise<void> {
  const current = await tx.findOne(core.class.Space, {
    _id: board.space.DefaultBoard
  })

  if (current === undefined) {
    await tx.createDoc(
      board.class.Board,
      core.space.Space,
      {
        name: 'Default',
        description: 'Default board',
        private: false,
        archived: false,
        members: [],
        type: board.template.DefaultBoard
      },
      board.space.DefaultBoard
    )
  }
}

async function createDefaults (tx: TxOperations): Promise<void> {
  await createSpace(tx)
  await createSequence(tx, board.class.Card)
  await createOrUpdate(
    tx,
    tags.class.TagCategory,
    tags.space.Tags,
    {
      icon: tags.icon.Tags,
      label: 'Other',
      targetClass: board.class.Card,
      tags: [],
      default: true
    },
    board.category.Other
  )
}

async function migrateIdentifiers (client: MigrationClient): Promise<void> {
  const docs = await client.find<Card>(DOMAIN_TASK, { _class: board.class.Card, identifier: { $exists: false } })
  for (const doc of docs) {
    await client.update(
      DOMAIN_TASK,
      { _id: doc._id },
      {
        identifier: `CARD-${doc.number}`
      }
    )
  }
}

export const boardOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {
    await tryMigrate(client, boardId, [
      {
        state: 'identifier',
        func: migrateIdentifiers
      }
    ])
  },
  async upgrade (client: MigrationUpgradeClient): Promise<void> {
    await tryUpgrade(client, boardId, [
      {
        state: 'board0001',
        func: async () => {
          const ops = new TxOperations(client, core.account.System)
          await createDefaults(ops)
        }
      }
    ])
  }
}
