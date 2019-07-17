# Redux models

[![Build](https://travis-ci.org/vshushkov/redux-models.svg?branch=master)](https://travis-ci.org/vshushkov/redux-models)
[![Test Coverage](https://codeclimate.com/github/vshushkov/redux-models/badges/coverage.svg)](https://codeclimate.com/github/vshushkov/redux-models/coverage)

Models layer for Redux. `redux-models` simplifies working with remote data (well.. not only remote) and helps to organize your code. 

## Installation

```bash
npm install --save redux redux-models
```

## Usage

##### `models/User.js`

```js
import { createModel } from 'redux-models';

export default createModel({
  name: 'User',
  methods: {
    findByUsername(username) {
      return fetch(`https://api.github.com/users/${username}`).then(res =>
        res.json()
      );
    }
  }
});
```

##### `store.js`

```js
import { combineReducers, applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import User from './models/User';

export default createStore(
  combineReducers({
    ...User.reducers
  }),
  applyMiddleware(thunk)
);
```

##### `app.js`

```jsx harmony
import React from 'react';
import { connect } from 'react-redux';
import User from './models/User';

class UserAvatar extends React.Component {
  componentDidMount() {
    const { fetchUser } = this.props;
    fetchUser();
  }

  render() {
    const { user } = this.props;

    if (!user) {
      return <div>Loading...</div>;
    }

    return <img src={user.avatar_url} alt="avatar" />;
  }
}

export default connect(
  (state, { username }) => ({
    user: User(state).findByUsername(username)
  }),
  (dispatch, { username }) => ({
    fetchUser: () => dispatch(User(state).findByUsername(username))
  })
)(UserAvatar);
```

[Live demo](https://codesandbox.io/s/redux-models-example-j74p7)

## API

### `createModel(options)`

#### Arguments

`options`:

- `options.name`: (`String`): Name of a model
- `options.methods`: (`Object`): Model's methods
- `options.reducer`: (`Function` [optional]): [Model reducer](#model-reducer).
- `options.typePrefix`: (`String` [optional]): Prefix of actions types. Default `@@redux-models`.
- `options.modelsState`: (`Function` [optional]): Function to map state to model state. Default `state => state[{ model name }]`.

#### Returns

### Model reducer

Additional data processing from the methods can be done in the model reducer.

Model reducer arguments are same as [redux reducers](https://redux.js.org/basics/reducers), except the last argument `types`. 
It contains all action types strings your models can dispatch.
In following example model `User` has one method `find` and can dispatch actions with types: `@@redux-models/USER/FIND`, `@@redux-models/USER/FIND_SUCCESS`, `@@redux-models/USER/FIND_ERROR`, `@@redux-models/USER/FIND_RESET`,
so `types` contains object:

```json5
{
  FIND: '@@redux-models/USER/FIND',
  find: '@@redux-models/USER/FIND',
  FIND_SUCCESS: '@@redux-models/USER/FIND_SUCCESS',
  findSuccess: '@@redux-models/USER/FIND_SUCCESS',
  FIND_ERROR: '@@redux-models/USER/FIND_ERROR',
  findError: '@@redux-models/USER/FIND_ERROR',
  FIND_RESET: '@@redux-models/USER/FIND_RESET',
  findReset: '@@redux-models/USER/FIND_RESET'
}
```

After processing, the data will be available in `state.{ model name }.model`.

#### Example

```js
import { createModel } from 'redux-models';

const defaultState = {
  byId: {}
};

export default createModel({
  name: 'User',
  methods: {
    find(query) {
      // async request
    }
  },
  reducer(state = defaultState, action, { findSuccess }) {
    const { type, payload: { result } = {} } = action;

    if (type === findSuccess) {
      return {
        ...state,
        byId: {
          ...state.byId,
          ...(result || []).reduce(
            (byId, user) => ({
              ...byId,
              [user.id]: user
            }),
            {}
          )
        }
      };
    }
    
    return state;
  }
});
```

Then:

```jsx harmony
import { connect } from 'react-redux';
// ...

export default connect(
  (state, { id }) => ({
    user: state.User.model.byId[id]
  })
)(UserCard);
```

## Future

- Mixins

## Contributing

See the [Contributors Guide](https://github.com/vshushkov/redux-models/blob/master/CONTIBUTING.md)

License
[MIT](https://github.com/vshushkov/redux-models/blob/master/LICENSE)
