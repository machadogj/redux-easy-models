import { combineReducers } from 'redux';
import { createAction } from 'redux-actions';
import { snakeCase, camelCase, endsWith } from 'lodash';

export default class Model {

  constructor(config) {

    this.name = config.name; // used as prefix and to combine reducers.
    this.config = config;
    this.prefix = `${snakeCase(config.name).toUpperCase()}_`;

    // initialize api. these are the functions that will be
    // used from containers or components. apis will automatically
    // dispatch the result of the underlaying action creator.
    this.api = {};

    // actionCreators are used internally, and could potentially
    // be private (ie: let actionCreators = {};). I leave in case
    // at some point there's the need to create an action without
    // automatically dispatching it.
    this.actionCreators = {};

    this.config.actions.forEach(action => {
      const actionName = action.name || action;
      const actionType = this.prefix + snakeCase(actionName).toUpperCase();
      if (typeof action === 'string') {
        // no need for START/SUCCESS/FAIL SINCE THERE'S NO BUSINESS LOGIC
        this.actionCreators[actionName] = createAction(actionType);
      } else {
        // it should be a named function!!!
        const TYPE_START = `${actionType}_STARTED`;
        const TYPE_FAIL = `${actionType}_FAILED`;
        const TYPE_SUCCESS = `${actionType}_SUCCESS`;
        this.actionCreators[TYPE_START] = createAction(TYPE_START);
        this.actionCreators[TYPE_SUCCESS] = createAction(TYPE_SUCCESS);
        this.actionCreators[TYPE_FAIL] = createAction(TYPE_FAIL);

        this.actionCreators[actionName] = (...args) => (dispatch) => {
          dispatch(this.actionCreators[TYPE_START](...args));
          let result;
          try {
            const executeAsync = action.bind(this.api);
            result = executeAsync(...args);
          } catch (error) {
            dispatch(this.actionCreators[TYPE_FAIL](error));
            throw error;
          }
          if (result && result.then && result.catch) {
            return result
              .then((data) => {
                dispatch(this.actionCreators[TYPE_SUCCESS](data));
                return data;
              })
              .catch((err) => {
                dispatch(this.actionCreators[TYPE_FAIL](err));
                throw err;
              });
          }
          dispatch(this.actionCreators[TYPE_SUCCESS](result));
          return result;
        };
      }
      this.api[actionName] = (...args) => this.dispatch(this.actionCreators[actionName](...args)); //eslint-disable-line
    });
  }
  reducer = (state = this.config.initialState, action) => {
    const reducerName = this.fromActionTypeToReducerName(action.type);
    if (this.config.reducers[reducerName]) {
      return this.config.reducers[reducerName](state, action);
    }
    if (endsWith(reducerName, 'Success')) {
      // if there's a handler without 'Success' at the end, then use it.
      const defaultReducerName = reducerName.substr(0, reducerName.length - 'Success'.length);
      if (this.config.reducers[defaultReducerName]) {
        return this.config.reducers[defaultReducerName](state, action);
      }
    }
    return state;
  };

  fromActionTypeToReducerName = (actionType) => camelCase(actionType.substring(this.prefix.length));

  init(store) {
    this.dispatch = store.dispatch;
    this.api.getState = store.getState;
    this.api.getMyState = () => store.getState()[this.config.name];
  }
}

/**
 * Combine a set of Model reducers.
 *
 * @param {(array|object)} models - An array or object containing Model objects.
 * @return {function} A combined redux reducer
 */
export function combineModelReducers(models) {
  let reducers = {};

  _iterateModels(models, (model) => {
    reducers[model.name] = model.reducer;
  });

  return combineReducers(reducers);
}

/**
 * Initialize a set of Models
 *
 * @param {(array|object)} models - An array or object containing Model objects.
 * @param {object} store - A redux store.
 */
export function initModels(models, store) {
  _iterateModels(models, (model) => {
    model.init(store);
  });
}

/**
 * Iterate over an array or object containing Model objects. Non-Model objects
 * are skipped silently.
 *
 * @param {(array|object)} models - An array or object containing Model objects.
 * @param {function} cb - The function to invoke with each Model object.
 */
function _iterateModels(models, cb) {
  if (models instanceof Array) {
    models.forEach((model) => {
      if (typeof model === 'object' && model.constructor.name === 'Model') {
        cb(model);
      }
    });
  } else if (typeof models === 'object') {
    for (let key in models) {
      if (models.hasOwnProperty(key)) {
        let model = models[key];
        if (typeof model === 'object' && model.constructor.name === 'Model') {
          cb(model);
        }
      }
    }
  } else {
    throw new TypeError("Parameter 'models' must be an array or object, not " + (typeof models));
  }
}
