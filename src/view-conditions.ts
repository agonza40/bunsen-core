import './typedefs'
import {BunsenView, BunsenCell, BunsenCellSet} from './view-types'
import {BunsenModel, Condition, ConditionSet} from './model-types'
import {meetsCondition} from './utils/conditionals'
import * as  _ from 'lodash'
import * as Immutable from 'seamless-immutable'

type ImmutableCell = Immutable.Immutable<BunsenCell>

/**
 * Function used for filtering out undefined values from arrays.
 *
 * @param {any} item Item we want to check the value of
 * @returns {boolean} True if the provided value is not undefined
 */
function isNotUndefined (item: any) {
  return item !== undefined
}

/**
 * Check a list conditions for a cell against a provided value
 *
 * @param {ValueWrapper} value The wrapped value we want to check the conditions against
 * @returns {Function} Function that returns true if a condition has been met
 */
function checkConditions (value: ValueWrapper): (condition: ConditionSet) => boolean {
  return function (condition: ConditionSet): boolean {
    const metCondition = (conditionItem: Condition[]) =>
        _.every(conditionItem, (condition, propName: string) =>
          meetsCondition(value.get(propName), condition)
        )

    if (condition.unless) {
      const unless = condition.unless.find(metCondition)
      if (unless !== undefined) {
        return false
      }
    }
    if (condition.if) {
      return isNotUndefined(condition.if.find(metCondition))
    } else {
      return true
    }
  }
}

/**
 * Check the root cells of a view
 *
 * @param {BunsenView} view View we are checking
 * @param {ValueWrapper} value The wrapped value we want to check the conditions against
 * @returns {Function} Iterator function to check cells
 */
function checkRootCells (view: BunsenView, value: any): (cell: BunsenCell) => BunsenCell | undefined {
  return function (cell: BunsenCell): BunsenCell | undefined {
    const checkedCell = checkCell(view, value, Immutable.from(cell))
    if (checkedCell) {
      return checkedCell.asMutable()
    }
  }
}

/**
 * Check a cell for conditions and apply any conditional properties if a condition is met.
 *
 * @param {BunsenView} view View the cell is a part of
 * @param {ValueWrapper} value The wrapped value we want to check the conditions against
 * @param {BunsenCell} cell Cell to check
 * @returns {BunsenCell} The cell after conditions have been processed. If a condition is not met undefined is returned
 */
function checkCellConditions (view: BunsenView, value: ValueWrapper, cell: ImmutableCell): ImmutableCell | undefined {
  const {conditions} = cell
  if (!conditions) {
    return
  }
  // Find a condition that has been met
  const meetsCondition = checkConditions(value)
  const condition = conditions.find(meetsCondition)
  if (condition === undefined) {
    // Returns undefined if conditions aren't met so we can filter
    return
  }

  if (condition.then) { // Cell has conditional properties, so add them
    cell = Immutable.merge(cell, condition.then)
  }
  return cell
}

/**
 * Copy properties from an extended cell. Extends child cells recrusively.
 *
 * @param {BunsenView} view View the cell is a part of
 * @param {BunsenCell} cell Cell to copy properties onto
 * @returns {BunsenCell} Resulting cell after applying properties from extended cells
 */
function expandExtendedCell (view: BunsenView, cell: ImmutableCell): ImmutableCell {
  if (!cell.extends) {
    return cell
  }
  const cellProps: BunsenCell = {}
  let extendedCell = _.get<BunsenCellSet, ImmutableCell>(view.cellDefinitions || {}, cell.extends)
  if (extendedCell === undefined) {
    return cell
  }
  if (extendedCell.extends) {
    extendedCell = Immutable.without(expandExtendedCell(view, extendedCell), 'extends')
  }
  const itemCell = _.get<ImmutableCell, ImmutableCell>(extendedCell, 'arrayOptions.itemCell')
  if (itemCell && itemCell.extends) {
    cellProps.arrayOptions = {
      itemCell: expandExtendedCell(view, itemCell)
    }
  }

  if (extendedCell.children) {
    const children = extendedCell.children as ImmutableCell[]
    cellProps.children = children.map(child => {
      if (child.extends) {
        return expandExtendedCell(view, child)
      }
      return child
    })
  }

  return Immutable.merge(cell, extendedCell, cellProps)
}

/**
 * Check a cell of a view to make sure the value meets any conditions the cell provides
 *
 * @param {BunsenView} view View we are checking
 * @param {ValueWrapper} value The wrapped value we want to check the conditions against
 * @param {BunsenCell} cell Cell to check
 * @returns {BunsenCell} Cell with properties from any extended cells
 */
function checkCell (view: BunsenView, value: ValueWrapper, cell: ImmutableCell): ImmutableCell | undefined {
  let newCell: ImmutableCell | undefined = expandExtendedCell(view, cell)

  value = value.pushPath(newCell.model)

  if (newCell.conditions) { // This cell has conditions
    newCell = checkCellConditions(view, value, cell)
    if (newCell === undefined) {
      return
    }
  }

  cell = checkChildren(view, value, cell)

  return Immutable.without(cell, 'conditions', 'extends')
}

/**
 * Check conditions of a cell's children
 *
 * @param {BunsenView} view View we are checking
 * @param {ValueWrapper} value The wrapped value we want to check the conditions against
 * @param {BunsenCell} cell Cell to check
 * @returns {BunsenCell} Cell with the children checked
 */
function checkChildren (view: BunsenView, value: ValueWrapper, cell: ImmutableCell): ImmutableCell {
  if (cell.children === undefined) {
    return cell
  }
  const children = cell.children.map(child => {
    return checkCell(view, value, child as Immutable.Immutable<BunsenCell>)
  })
  .filter(isNotUndefined)

  return Immutable.set(cell, 'children', children)
}

/**
 * Apply conditions (and extensions) to the cells of a view
 *
 * @export
 * @param {BunsenView} view View to process
 * @param {any} value The value we want to check conditions against
 * @returns {BunsenView} View after conditions have been applied
 */
export default function evaluateView (view: BunsenView, value: any): BunsenView {
  const wrappedValue = new ValueWrapper(value, [])
  const immutableView = Immutable.from(view)
  if (view.cells === undefined) {
    return view
  }
  try {
    const cells = _.chain(view.cells)
      .map(checkRootCells(immutableView, wrappedValue))
      .filter(isNotUndefined)
      .value()

    return Object.assign(_.clone(view), {
      cells
    })
  } catch (e) {
    // Unfortunately this is necessary because view validation happens outside of the reducer,
    // so we have no guarantee that the view is valid and it may cause run time errors. Returning
    return view
  }
}
/* eslint-disable complexity */
/**
 * Find how many path elements we have to go back in order to find the absolute path
 *
 * @param {string[]} path Array of path elements. THIS ARRAY IS MUTATED BY THE FUNCTION
 * @param {number} [index=0] How many elements we've already gone back
 * @returns {number} How many elements back we need go
 */
function findRelativePath (path: string[], index = 0): number {
  let nextInPath = _.last(path)

  if (nextInPath === '') { // . for sibling
    if (index <= 0) {
      index += 1
    }
    path.pop()
    if (_.last(path) === '') { // .. for sibling of parent
      path.pop()
      nextInPath = (path.pop() as string).replace('/', '')// get rid of leading slash
      if (nextInPath === '') {
        return findRelativePath(path, index + 1)
      }
      path.push(nextInPath)
      return index + 1
    } else {
      nextInPath = (path.pop() as string).replace('/', '')// get rid of leading slash
      if (nextInPath === '') {
        return findRelativePath(path, index)
      }
      path.push(nextInPath)
      return index
    }
  }
  return index
}
/* eslint-enable complexity */

/**
 * Class to wrap value objects to find values based on relative and absolute paths
 *
 * @class ValueWrapper
 */
class ValueWrapper {
  private value: any
  private path: string[]
  constructor (value: any, curPath: string[] | string) {
    this.value = value
    this.path = ValueWrapper.pathAsArray(curPath)
  }

  static pathAsArray (path: string[] | string): string[] {
    if (!Array.isArray(path)) {
      return path.split('.')
    }
    return path
  }

  /**
   * Get the value at an absolute or relative path. Paths with a leading './' or '../' are treated as relative,
   * and others are treated as absolute.
   *
   * Relative paths are relative to a stored path. To add to the path use the pushPath method.
   *
   * @param {string | string[]} path Path to the desired value.
   * @returns {any} Value at the given path.
   *
   * @memberOf ValueWrapper
   */
  get (path: string | string[]): any {
    let absolutePath
    if (path === undefined) {
      if (this.path.length <= 0) {
        return this.value
      }
      return _.get(this.value, this.path.join('.'))
    }
    path = ValueWrapper.pathAsArray(path)

    let nextInPath = _.first(path)

    if (nextInPath === '') {
      let index = findRelativePath(path.reverse())
      absolutePath = this.path.slice(0, this.path.length - index).concat(path)
    } else {
      absolutePath = path
    }

    return _.get(this.value, absolutePath.join('.'))
  }

  /**
   * Creates another value wrapper with a relative path
   *
   * @param {string | string[]} path Element(s) to add to the currently stored path
   * @returns {ValueWrapper} A value wrapper with the new path elements
   *
   * @memberOf ValueWrapper
   */
  pushPath (path: string | string[] | undefined): ValueWrapper {
    if (path === undefined) {
      return this
    }
    path = ValueWrapper.pathAsArray(path)
    return new ValueWrapper(this.value, this.path.concat(path))
  }
}
