import { request } from 'graphql-request';

const BAMBOO_ENDPOINT = 'http://localhost:8000/graphql';

export default async function graphQLRequest(query, variables) {
  try {
    return await request(BAMBOO_ENDPOINT, query, variables);
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error && error.response && error.response.errors) {
      errorMessage = error.response.errors
        .map(({ message }) => message)
        .join(' ');
    }

    throw new Error(`GraphQL error response: ${errorMessage}`);
  }
}
