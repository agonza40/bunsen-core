import './typedefs'
import {BunsenCell, BunsenCellSet, BunsenView} from './view-types'
import {BunsenModel, BunsenModelSet} from './model-types'
import * as _ from 'lodash'

import {dereference} from './dereference'

/**
 * Take the properties of an object and put primitive types above non-primitive types
 * @param {BunsenModelSet} properties - the properties for the model (key-value)
 * @returns {String[]} an array of property names in the order we should display them
 */
function getPropertyOrder (properties?: BunsenModelSet): string[] {
  if (properties === undefined) {
    return []
  }
  const primitiveProps: string[] = []
  const complexProps: string[] = []

  _.forIn(properties, (prop: BunsenModel, propName: string) => {
    if (prop.type === 'object' || prop.type === 'array') {
      complexProps.push(propName)
    } else {
      primitiveProps.push(propName)
    }
  })

  return primitiveProps.concat(complexProps)
}

/**
 * Add a model cell for the given model
 * @param {String} propertyName - the name of the property that holds the model
 * @param {BunsenModel} model - the model to add a cell for
 * @param {BunsenCell[]} cellDefinitions - the cells set to add the model cell to
 * @returns {String} the cell name
 */
function addModelCell (propertyName: string, model: BunsenModel, cellDefinitions: BunsenCellSet): string {
  const cell = {
    children: []
  }

  let defName = propertyName
  let counter = 1

  while (defName in cellDefinitions) {
    defName = `${propertyName}${counter}`
    counter++
  }

  cellDefinitions[defName] = cell

  const props = getPropertyOrder(model.properties)
  props.forEach((propName) => {
    if (model.properties === undefined) {
      return
    }
    // we have a circular dependency
    /* eslint-disable no-use-before-define */
    addModel(propName, model.properties[propName], cell.children, cellDefinitions)
    /* eslint-enable no-use-before-define */
  })

  if (model.dependencies) {
    const dependencies = model.dependencies
    _.forIn(dependencies, (dep, depName: string) => {
      const depProps = dep instanceof Array ? dep : getPropertyOrder(dep.properties)

      depProps.forEach((propName) => {
        // we have a circular dependency
        /* eslint-disable no-use-before-define */
        addDependentModel(propName, depName, dep.properties[propName], cell.children, cellDefinitions)
        /* eslint-enable no-use-before-define */
      })
    })
  }

  return defName
}

/**
 * Add a property to default layout
 * @param {String} propertyName - the name of the property that holds this model
 * @param {BunsenModel} model - the actual model
 * @param {BunsenRow[]} children - the children we're adding the given model wrapper to
 * @param {BunsenCell[]} cellDefinitions - the set of all cells
 */
function addModel (propertyName: string, model: BunsenModel, children: BunsenCell[], cellDefinitions: BunsenCellSet) {
  const cell: BunsenCell = {
    model: propertyName
  }

  switch (model.type) {
    case 'array':
      if (model.items !== undefined) {
        const cellId = addModelCell(propertyName, model.items, cellDefinitions)
        cell.arrayOptions = {
          itemCell: {
            extends: cellId
          }
        }
      }
      break

    case 'object':
      const cellId = addModelCell(propertyName, model, cellDefinitions)
      cell.extends = cellId
      break
  }

  children.push(cell)
}

/**
 * Add a property to default layout
 * @param {String} propertyName - the name of the property that holds this model
 * @param {String} dependencyName - the name of the dependency of this model
 * @param {BunsenModel} model - the actual model
 * @param {BunsenRow[]} children - the children we're adding the given model wrapper to
 * @param {BunsenCell[]} cellDefinitions - the set of all cells
 */
function addDependentModel (
  propertyName: string,
  dependencyName: string,
  model: BunsenModel,
  children: BunsenCell[][],
  cellDefinitions: BunsenCellSet
) {
  const cell: BunsenCell = {
    model: propertyName,
    dependsOn: dependencyName
  }

  const isObject = (model.type === 'object')
  const isArray = (model.type === 'array') && model.items && (model.items.type === 'object')

  if (isObject || isArray) {
    const subModel = isArray ? model.items : model
    const cellId = addModelCell(propertyName, subModel, cellDefinitions)
    if (isArray) {
      cell.arrayOptions = {
        itemCell: {
          extends: cellId
        }
      }
    } else {
      cell.extends = cellId
    }
  }
  children.push(cell)
}

/**
 * Generate a default view for a JSON schema model
 * @param {BunsenModel} schema - the schema to generate a default view for
 * @returns {BunsenView} the generated view
 */
export function generateView (schema: BunsenModel): BunsenView {
  const model = dereference(schema || {}).schema

  const view = {
    version: '2.0',
    type: 'form',
    cells: [{extends: 'main'}],
    cellDefinitions: {
      main: {
        children: []
      }
    }
  }

  const props = getPropertyOrder(model.properties)
  props.forEach((propName) => {
    addModel(propName, model.properties[propName], view.cellDefinitions['main'].children, view.cellDefinitions)
  })

  return view
}

export default generateView
