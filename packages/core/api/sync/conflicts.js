/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2022 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

class Conflicts {
  /**
   *
   * @param {import('../index').default} db
   */
  constructor(db) {
    this._db = db;
  }

  async recalculate() {
    if (this._db.notes.conflicted.length <= 0) {
      await this._db.storage.write("hasConflicts", false);
    }
  }

  check() {
    return this._db.storage.read("hasConflicts");
  }

  throw() {
    throw new Error(
      "Merge conflicts detected. Please resolve all conflicts to continue syncing.",
      { cause: "MERGE_CONFLICT" }
    );
  }
}
export default Conflicts;
