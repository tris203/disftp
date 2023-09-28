const config = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/github',
    '@codedependant/semantic-release-docker', {
      dockerProject: 'tris203',
      dockerArgs: {
        RELEASE_VERSION: '{{next.version}}',
      }
      
    }
  ],
};

module.exports = config;
