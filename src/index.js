import { combineReducers } from 'redux';
import snakeCase from 'lodash/snakeCase';
import isFunction from 'lodash/isFunction';
import isEqual from 'lodash/isEqual';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';

export function createModel(options = {}) {
  const {
    typePrefix = '@@redux-models',
    modelsState = (state) => state,
    name = Math.random()
      .toString(36)
      .substring(7)
      .toUpperCase(),
    methods,
    reducer: modelReducer,
    reducers: methodReducers
  } = options;

  const model = {};
  const _methods = normalizeMethods(methods);

  createActions({ typePrefix, modelName: name, methods: _methods, model });

  const reducers = createReducers({
    model,
    typePrefix,
    modelName: name,
    methods: _methods,
    reducer: modelReducer,
    reducers: methodReducers
  });

  model.reducer = combineReducers(reducers);
  model.reducers = { [name]: model.reducer };
  model.selectors = createDefaultSelectors({
    methods: _methods,
    reducers,
    modelsState
  });

  return model;
}

function normalizeMethods(methods) {
  return isArray(methods)
    ? methods
        .map(method => ({
          methodName: isString(method) ? method : method.name,
          method
        }))
        .filter(({ methodName }) => !!methodName)
    : Object.keys(methods).map(methodName => ({
        methodName,
        method: methods[methodName]
      }));
}

function methodNameToTypes({ typePrefix, modelName, methodName }) {
  const type = `${typePrefix}/${snakeCase(modelName).toUpperCase()}/${snakeCase(
    methodName
  ).toUpperCase()}`;
  return [type, `${type}_SUCCESS`, `${type}_ERROR`, `${type}_RESET`];
}

function actionConstants({ typePrefix, modelName, methodName }) {
  const [start, success, error, reset] = methodNameToTypes({
    typePrefix,
    modelName,
    methodName
  });

  const type = snakeCase(methodName).toUpperCase();

  return {
    [type]: start,
    [methodName]: start,
    [`${type}_SUCCESS`]: success,
    [`${methodName}Success`]: success,
    [`${type}_ERROR`]: error,
    [`${methodName}Error`]: error,
    [`${type}_RESET`]: reset,
    [`${methodName}Reset`]: reset
  };
}

function createActions({ typePrefix, modelName, methods, model }) {
  methods.forEach(({ method, methodName }) => {
    const [start, success, failure, reset] = methodNameToTypes({
      typePrefix,
      modelName,
      methodName
    });

    model[methodName] = createAction({
      model,
      modelName,
      methodName,
      method,
      types: { start, success, failure }
    });

    model[`${methodName}Reset`] = () => ({ type: reset });
  });
}

function createAction({ modelName, methodName, method, types, model }) {
  const { start, success, failure } = types;

  if (!isFunction(method)) {
    return params => ({ type: start, payload: { params, result: method } });
  }

  function startAction(params) {
    return { type: start, payload: { params } };
  }

  function successAction(params, result) {
    return { type: success, payload: { params, result } };
  }

  function failureAction(params, error) {
    return { type: failure, payload: { params, error } };
  }

  function action(...params) {
    action.asyncAction = false;
    const result = method.call(model, ...params);

    if (result && isFunction(result.then)) {
      action.asyncAction = true;
      const asyncAction = dispatch => {
        dispatch(startAction(params));

        return result
          .then(result => {
            dispatch(successAction(params, result));
            return result;
          })
          .catch(error => {
            dispatch(failureAction(params, error));
            throw error;
          });
      };

      asyncAction.actionParams = params;
      return asyncAction;
    }

    return { type: start, payload: { params, result } };
  }

  action.modelName = modelName;
  action.actionName = methodName;

  return action;
}

function createReducers({
  typePrefix,
  modelName,
  methods,
  reducer,
  reducers,
  model
}) {
  const constants = methods.reduce(
    (constants, { methodName }) => ({
      ...constants,
      ...actionConstants({ typePrefix, modelName, methodName })
    }),
    {}
  );

  const modelReducer =
    isFunction(reducer) &&
    ((state, action) => reducer(state, action, constants));

  const methodsReducers = methods.reduce((actions, { methodName }) => {
    const types = methodNameToTypes({ typePrefix, modelName, methodName });
    const isDefault = !reducers || !isFunction(reducers[methodName]);
    const reducer = isDefault
      ? createDefaultMethodReducer({ types, action: model[methodName] })
      : (state, action) => reducers[methodName](state, action, types);

    reducer.isDefault = isDefault;

    return {
      ...actions,
      [methodName]: reducer
    };
  }, {});

  if (modelReducer) {
    return {
      ...methodsReducers,
      model: modelReducer
    };
  }

  return methodsReducers;
}

const resultInitialState = {
  params: null,
  result: null,
  requesting: false,
  requested: false,
  error: null,
  updatedAt: null
};

function createDefaultMethodReducer({ types, action: methodAction }) {
  const [start, success, failure, reset] = types;

  return function defaultMethodReducer(state = [], action) {
    const asyncAction = methodAction.asyncAction === true;

    if (action.type === reset) {
      return [];
    }

    if (![start, success, failure].includes(action.type)) {
      return state;
    }

    const { params = null, result = null, error = null } = action.payload || {};

    const requesting = asyncAction ? action.type === start : false;
    const requested = asyncAction
      ? action.type === success || action.type === failure
      : true;
    const index = state.findIndex(row => isEqual(row.params, params));
    const updatedAt = Date.now();

    if (index === -1) {
      return [
        ...state,
        {
          ...resultInitialState,
          result,
          params,
          error,
          requesting,
          requested,
          updatedAt
        }
      ];
    }

    return [
      ...state.slice(0, index),
      {
        ...state[index],
        params,
        result:
          action.type === start
            ? state[index].result
            : action.type === success
              ? result
              : null,
        error,
        requesting,
        requested: true,
        updatedAt
      },
      ...state.slice(index + 1, state.length)
    ];
  };
}

function createSelector({ field, methodState }) {
  return (...params) => {
    const result =
      methodState.find(row => isEqual(params, row.params)) ||
      resultInitialState;

    return field ? result[field] : result;
  };
}

function createDefaultSelectors({ methods, reducers, modelsState }) {
  return storeState => {
    const state = isFunction(modelsState)
      ? modelsState(storeState)
      : storeState;

    return methods
      .filter(
        ({ methodName }) =>
          reducers[methodName] && reducers[methodName].isDefault
      )
      .reduce((selectors, { methodName }) => {
        const methodState = state[methodName] || [];

        return {
          ...selectors,
          [methodName]: createSelector({
            methodState,
            field: 'result'
          }),
          [`${methodName}Meta`]: createSelector({
            methodState
          })
        };
      }, {});
  };
}
