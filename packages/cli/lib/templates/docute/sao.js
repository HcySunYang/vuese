module.exports = options => {
  const { title, components, markdownDir, docuteOptions = {} } = options
  const groupsObjs = {}
  const groups = []
  components.forEach(c => {
    const res = {
      title: c.compName,
      link: '/' + markdownDir + '/' + c.compName
    }
    if (groupsObjs[c.groupName]) {
      groupsObjs[c.groupName].push(res)
    } else {
      groupsObjs[c.groupName] = [res]
    }
  })
  Object.keys(groupsObjs).forEach(name => {
    groups.push({
      title: name,
      links: groupsObjs[name].sort((a, b) => (a.name > b.name ? 1 : -1))
    })
  })
  groups.sort((a, b) => {
    if (a.title === '') return -1
    if (b.title === '') return 1
    return a.title > b.title ? 1 : -1
  })
  groups.forEach(group => {
    group.links.sort((a, b) => {
      if (a.title < b.title) return -1
      if (a.title > b.title) return 1
      return 0;
    })
  })
  const config = {
    data(answers) {
      return {
        title: title || answers.title,
        markdownDir,
        docuteConfig: JSON.stringify({
          ...docuteOptions,
          target: '#docute',
          sidebar: [...docuteOptions.sidebar, ...groups]
        })
      }
    }
  }
  if (!title)
    config.prompts = {
      title: {
        type: 'input',
        message: 'Sidbar title:',
        default: 'Components'
      }
    }
  return config
}
