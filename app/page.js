'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, User, Clock, AlertCircle, ChevronDown, ChevronUp, Check, LogOut, CheckCircle, Calendar, TrendingUp, Settings, ChevronLeft, ChevronRight, X, Upload, FileText, Download, Trash2, Clipboard } from 'lucide-react'

export default function FabShopTracker() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [fabricators, setFabricators] = useState([])
  const [view, setView] = useState('manager')
  const [selectedFabricator, setSelectedFabricator] = useState('all')
  const [showAddProject, setShowAddProject] = useState(false)
  const [showFabSettings, setShowFabSettings] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState(new Set())
  const [activeTab, setActiveTab] = useState('queue')
  const [newFabName, setNewFabName] = useState('')
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()))
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const router = useRouter()

  const [newProject, setNewProject] = useState({
    project_name: '',
    customer_name: '',
    assigned_to: 'Unassigned',
    hours_allocated: '',
    start_date: '',
    deadline: '',
    priority: 'Medium',
    notes: '',
    project_type: 'Welding',
    attachments: []
  })

  function getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  function getWeekDays(startDate) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      days.push(date)
    }
    return days
  }

  useEffect(() => {
    checkUser()
    fetchProjects()
    fetchFabricators()
    
    const subscription = supabase
      .channel('projects_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, 
        () => fetchProjects()
      )
      .subscribe()

    const fabSubscription = supabase
      .channel('fabricators_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fabricators' },
        () => fetchFabricators()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      fabSubscription.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setUser(user)
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching projects:', error)
    } else {
      setProjects(data || [])
    }
  }

  const fetchFabricators = async () => {
    const { data, error } = await supabase
      .from('fabricators')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching fabricators:', error)
    } else {
      setFabricators(data || [])
    }
  }

  const addFabricator = async () => {
    if (newFabName.trim()) {
      const { error } = await supabase
        .from('fabricators')
        .insert([{ name: newFabName.trim() }])
      
      if (!error) {
        setNewFabName('')
        fetchFabricators()
      }
    }
  }

  const deleteFabricator = async (id) => {
    if (confirm('Are you sure? This will not delete their projects.')) {
      await supabase.from('fabricators').delete().eq('id', id)
      fetchFabricators()
    }
  }

  const handleFileUpload = async (files) => {
    setUploadingFiles(true)
    const uploadedFiles = []

    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('project-attachments')
        .upload(filePath, file)

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('project-attachments')
          .getPublicUrl(filePath)

        uploadedFiles.push({
          name: file.name,
          url: publicUrl,
          path: filePath,
          size: file.size,
          type: file.type
        })
      }
    }

    setNewProject({
      ...newProject,
      attachments: [...(newProject.attachments || []), ...uploadedFiles]
    })
    setUploadingFiles(false)
  }

  const removeAttachment = (index) => {
    const newAttachments = [...newProject.attachments]
    newAttachments.splice(index, 1)
    setNewProject({ ...newProject, attachments: newAttachments })
  }

  const addProject = async () => {
    if (newProject.project_name && newProject.hours_allocated && newProject.start_date && newProject.deadline) {
      const { error } = await supabase
        .from('projects')
        .insert([{
          ...newProject,
          status: 'Not Started',
          hours_used: 0,
          progress_percent: 0,
          hours_allocated: parseInt(newProject.hours_allocated),
          milestones: [],
          attachments: newProject.attachments || []
        }])
      
      if (error) {
        console.error('Error adding project:', error)
      } else {
        setNewProject({
          project_name: '',
          customer_name: '',
          assigned_to: 'Unassigned',
          hours_allocated: '',
          start_date: '',
          deadline: '',
          priority: 'Medium',
          notes: '',
          project_type: 'Welding',
          attachments: []
        })
        setShowAddProject(false)
        fetchProjects()
      }
    }
  }

  const updateProject = async (id, updates) => {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
    
    if (error) {
      console.error('Error updating project:', error)
    }
  }

  const assignProject = async (projectId, fabricatorName) => {
    await updateProject(projectId, { assigned_to: fabricatorName })
  }

  const markComplete = async (id) => {
    const project = projects.find(p => p.id === id)
    await updateProject(id, { 
      status: 'Completed', 
      progress_percent: 100,
      hours_used: project.hours_allocated,
      completed_at: new Date().toISOString()
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedProjects(newExpanded)
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Not Started': return 'bg-gray-100 text-gray-700'
      case 'In Progress': return 'bg-blue-100 text-blue-700'
      case 'Completed': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'High': return 'text-red-600'
      case 'Medium': return 'text-yellow-600'
      case 'Low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getDaysUntilDeadline = (deadline) => {
    const today = new Date()
    const due = new Date(deadline)
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getProjectUrgency = (project) => {
    if (project.status === 'Completed') return 'completed'
    const daysLeft = getDaysUntilDeadline(project.deadline)
    const hoursOverBudget = project.hours_used > project.hours_allocated
    
    if (daysLeft < 0) return 'overdue'
    if (hoursOverBudget || daysLeft <= 2) return 'critical'
    if (daysLeft <= 5 || project.priority === 'High') return 'urgent'
    return 'normal'
  }

  const isProjectInWeek = (project, weekStart) => {
    const startDate = new Date(project.start_date)
    const deadline = new Date(project.deadline)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    return (startDate <= weekEnd && deadline >= weekStart)
  }

  const isProjectOnDay = (project, day) => {
    const startDate = new Date(project.start_date)
    const deadline = new Date(project.deadline)
    const checkDay = new Date(day)
    
    startDate.setHours(0, 0, 0, 0)
    deadline.setHours(0, 0, 0, 0)
    checkDay.setHours(0, 0, 0, 0)
    
    return checkDay >= startDate && checkDay <= deadline
  }

  const getFabricatorWorkload = (fabricatorName, weekStart) => {
    const weekProjects = projects.filter(p => 
      p.assigned_to === fabricatorName && 
      p.status !== 'Completed' &&
      isProjectInWeek(p, weekStart)
    )
    const totalHours = weekProjects.reduce((sum, p) => sum + (p.hours_allocated - p.hours_used), 0)
    return { projects: weekProjects, hours: totalHours }
  }

  const navigateWeek = (direction) => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(currentWeekStart.getDate() + (direction * 7))
    setCurrentWeekStart(newStart)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  const unassignedProjects = projects.filter(p => p.assigned_to === 'Unassigned' && p.status !== 'Completed')
  const activeProjects = projects.filter(p => p.status !== 'Completed' && p.assigned_to !== 'Unassigned')
  const completedProjects = projects.filter(p => p.status === 'Completed')

  const filteredActive = selectedFabricator === 'all' 
    ? activeProjects 
    : activeProjects.filter(p => p.assigned_to === selectedFabricator)

  const filteredCompleted = selectedFabricator === 'all' 
    ? completedProjects 
    : completedProjects.filter(p => p.assigned_to === selectedFabricator)

  const sortedActive = [...filteredActive].sort((a, b) => {
    const urgencyOrder = { 'overdue': 0, 'critical': 1, 'urgent': 2, 'normal': 3 }
    const aUrgency = getProjectUrgency(a)
    const bUrgency = getProjectUrgency(b)
    
    if (urgencyOrder[aUrgency] !== urgencyOrder[bUrgency]) {
      return urgencyOrder[aUrgency] - urgencyOrder[bUrgency]
    }
    
    return new Date(a.deadline) - new Date(b.deadline)
  })

  const sortedCompleted = [...filteredCompleted].sort((a, b) => {
    return new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at)
  })

  const sortedUnassigned = [...unassignedProjects].sort((a, b) => {
    const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return new Date(a.deadline) - new Date(b.deadline)
  })

  const upNextProjects = sortedActive.slice(0, 3)
  const weekDays = getWeekDays(currentWeekStart)

  const displayProjects = activeTab === 'active' ? sortedActive : 
                         activeTab === 'completed' ? sortedCompleted :
                         sortedUnassigned

  const stats = {
    unassigned: unassignedProjects.length,
    active: activeProjects.length,
    completed: completedProjects.length,
    overdue: activeProjects.filter(p => getDaysUntilDeadline(p.deadline) < 0).length,
    completedThisWeek: completedProjects.filter(p => {
      const completed = new Date(p.completed_at || p.updated_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return completed >= weekAgo
    }).length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-t-4" style={{ borderColor: '#2b388f' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://gfevpvqpaujhorgbjmll.supabase.co/storage/v1/object/public/assets/panelclad_02@3x.png" 
                alt="PanelClad Logo" 
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#1e1e21' }}>Fabrication Shop Tracker</h1>
                <p className="text-sm text-gray-500">PanelClad Project Management</p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <span className="text-sm text-gray-600">{user?.email}</span>
              {view === 'manager' && (
                <button
                  onClick={() => setShowFabSettings(!showFabSettings)}
                  className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg hover:bg-gray-50 transition-all"
                  style={{ borderColor: '#2b388f', color: '#2b388f' }}
                >
                  <Settings size={18} />
                  Team
                </button>
              )}
              <select 
                value={view} 
                onChange={(e) => setView(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              >
                <option value="manager">Manager View</option>
                <option value="fabricator">Fabricator View</option>
              </select>
              {view === 'manager' && (
                <button
                  onClick={() => setShowAddProject(!showAddProject)}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all"
                  style={{ backgroundColor: '#2b388f' }}
                >
                  <Plus size={20} />
                  Add Project
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all"
                style={{ backgroundColor: '#1e1e21' }}
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unassigned</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.unassigned}</p>
                </div>
                <Clipboard size={32} className="text-orange-500" />
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border-l-4" style={{ borderColor: '#2b388f' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Projects</p>
                  <p className="text-3xl font-bold" style={{ color: '#2b388f' }}>{stats.active}</p>
                </div>
                <TrendingUp size={32} style={{ color: '#2b388f' }} />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle size={32} className="text-green-500" />
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <AlertCircle size={32} className="text-red-500" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Done This Week</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.completedThisWeek}</p>
                </div>
                <Calendar size={32} className="text-purple-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <User size={20} className="text-gray-500" />
            <select
              value={selectedFabricator}
              onChange={(e) => setSelectedFabricator(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
            >
              <option value="all">All Fabricators</option>
              {fabricators.map(fab => (
                <option key={fab.id} value={fab.name}>{fab.name}</option>
              ))}
            </select>
          </div>
        </div>

        {showFabSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{ color: '#2b388f' }}>Manage Team</h2>
                <button onClick={() => setShowFabSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Fabricator name"
                  value={newFabName}
                  onChange={(e) => setNewFabName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addFabricator()}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                />
                <button
                  onClick={addFabricator}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                  style={{ backgroundColor: '#2b388f' }}
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fabricators.map(fab => (
                  <div key={fab.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{fab.name}</span>
                    <button
                      onClick={() => deleteFabricator(fab.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'active' && upNextProjects.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 mb-6 border-l-4" style={{ borderColor: '#2b388f' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#2b388f' }}>
              <Clock size={24} />
              Up Next - Priority Queue
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {upNextProjects.map((project, idx) => {
                const daysLeft = getDaysUntilDeadline(project.deadline)
                const urgency = getProjectUrgency(project)
                const duration = Math.ceil((new Date(project.deadline) - new Date(project.start_date)) / (1000 * 60 * 60 * 24)) + 1
                return (
                  <div key={project.id} className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-300">#{idx + 1}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        urgency === 'overdue' ? 'bg-red-100 text-red-700' :
                        urgency === 'critical' ? 'bg-orange-100 text-orange-700' :
                        urgency === 'urgent' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {urgency === 'overdue' ? 'OVERDUE' : `${daysLeft}d left`}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{project.project_name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{project.assigned_to}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{duration} day{duration > 1 ? 's' : ''}</span>
                      <span>{project.hours_used}/{project.hours_allocated}h</span>
                      <span className={getPriorityColor(project.priority)}>{project.priority}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {showAddProject && view === 'manager' && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#2b388f' }}>New Project</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Project Name *"
                value={newProject.project_name}
                onChange={(e) => setNewProject({...newProject, project_name: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Customer Name"
                value={newProject.customer_name}
                onChange={(e) => setNewProject({...newProject, customer_name: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              />
              <select
                value={newProject.project_type}
                onChange={(e) => setNewProject({...newProject, project_type: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              >
                <option value="Welding">Welding</option>
                <option value="Assembly">Assembly</option>
                <option value="Fabrication">Fabrication</option>
                <option value="Repair">Repair</option>
                <option value="Custom">Custom</option>
              </select>
              <input
                type="number"
                placeholder="Hours Allocated *"
                value={newProject.hours_allocated}
                onChange={(e) => setNewProject({...newProject, hours_allocated: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={newProject.start_date}
                  onChange={(e) => setNewProject({...newProject, start_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Deadline) *</label>
                <input
                  type="date"
                  value={newProject.deadline}
                  onChange={(e) => setNewProject({...newProject, deadline: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                />
              </div>
              <select
                value={newProject.priority}
                onChange={(e) => setNewProject({...newProject, priority: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
              </select>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newProject.notes}
                onChange={(e) => setNewProject({...newProject, notes: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              />
            </div>
            
            {/* File Upload Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments (Drawings, Specifications, etc.)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.dwg"
                  onChange={(e) => handleFileUpload(Array.from(e.target.files))}
                  className="hidden"
                  id="file-upload"
                  disabled={uploadingFiles}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload size={32} className="text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {uploadingFiles ? 'Uploading...' : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-xs text-gray-500">PDF, JPG, PNG, DWG up to 10MB each</span>
                </label>
              </div>
              
              {newProject.attachments && newProject.attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {newProject.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText size={20} className="text-gray-600" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={addProject}
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 transition-all"
                style={{ backgroundColor: '#2b388f' }}
                disabled={uploadingFiles}
              >
                {uploadingFiles ? 'Uploading Files...' : 'Create Project'}
              </button>
              <button
                onClick={() => setShowAddProject(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'queue' 
                  ? 'bg-orange-600 border-b-4 border-orange-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clipboard size={20} />
                Unassigned Queue ({stats.unassigned})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'active' 
                  ? 'border-b-4 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={activeTab === 'active' ? { backgroundColor: '#2b388f', borderColor: '#2b388f' } : {}}
            >
              Active Projects ({stats.active})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'completed' 
                  ? 'bg-green-600 border-b-4 border-green-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Completed Projects ({stats.completed})
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'calendar' 
                  ? 'bg-purple-600 border-b-4 border-purple-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={20} />
              Weekly Schedule
            </button>
          </div>
        </div>

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold" style={{ color: '#2b388f' }}>Weekly Schedule</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateWeek(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="font-semibold text-lg">
                  {currentWeekStart.toLocaleDateString()} - {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
                <button
                  onClick={() => navigateWeek(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight size={24} />
                </button>
                <button
                  onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
                  className="px-4 py-2 rounded-lg hover:opacity-90 text-white"
                  style={{ backgroundColor: '#2b388f' }}
                >
                  Today
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-3 bg-gray-50 sticky left-0 z-10 min-w-[150px]">Fabricator</th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className="border p-3 bg-gray-50 min-w-[140px]">
                        <div className="text-sm font-semibold">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xs text-gray-600">{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </th>
                    ))}
                    <th className="border p-3 bg-gray-50 min-w-[100px]">Workload</th>
                  </tr>
                </thead>
                <tbody>
                  {fabricators.map(fab => {
                    const workload = getFabricatorWorkload(fab.name, currentWeekStart)
                    return (
                      <tr key={fab.id}>
                        <td className="border p-3 font-semibold sticky left-0 bg-white z-10">{fab.name}</td>
                        {weekDays.map(day => {
                          const dayProjects = projects.filter(p => 
                            p.assigned_to === fab.name && 
                            p.status !== 'Completed' &&
                            isProjectOnDay(p, day)
                          )
                          return (
                            <td key={day.toISOString()} className="border p-2 align-top">
                              {dayProjects.map(proj => {
                                const urgency = getProjectUrgency(proj)
                                const isStart = new Date(proj.start_date).toDateString() === day.toDateString()
                                const isEnd = new Date(proj.deadline).toDateString() === day.toDateString()
                                return (
                                  <div 
                                    key={proj.id} 
                                    className={`mb-2 p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow ${
                                      urgency === 'overdue' ? 'bg-red-100 border-l-2 border-red-500' :
                                      urgency === 'critical' ? 'bg-orange-100 border-l-2 border-orange-500' :
                                      urgency === 'urgent' ? 'bg-yellow-100 border-l-2 border-yellow-500' :
                                      'bg-blue-50 border-l-2 border-blue-500'
                                    }`}
                                    onClick={() => toggleExpanded(proj.id)}
                                  >
                                    <div className="font-semibold truncate">
                                      {isStart && '▶ '}{proj.project_name}{isEnd && ' ◀'}
                                    </div>
                                    <div className="text-gray-600 mt-1">{proj.hours_allocated - proj.hours_used}h left</div>
                                  </div>
                                )
                              })}
                            </td>
                          )
                        })}
                        <td className="border p-3 text-center">
                          <div className="font-bold text-lg" style={{ color: workload.hours > 40 ? '#ef4444' : '#2b388f' }}>
                            {workload.hours}h
                          </div>
                          <div className="text-xs text-gray-600">
                            {workload.projects.length} projects
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 'queue' || activeTab === 'active' || activeTab === 'completed') && (
          <div className="space-y-4">
            {displayProjects.map(project => {
              const daysLeft = getDaysUntilDeadline(project.deadline)
              const isExpanded = expandedProjects.has(project.id)
              const hoursRemaining = project.hours_allocated - project.hours_used
              const isOverBudget = project.hours_used > project.hours_allocated
              const urgency = getProjectUrgency(project)
              const duration = Math.ceil((new Date(project.deadline) - new Date(project.start_date)) / (1000 * 60 * 60 * 24)) + 1
              
              return (
                <div key={project.id} className={`bg-white rounded-xl shadow-md overflow-hidden transition-all hover:shadow-lg ${
                  activeTab === 'queue' ? 'border-l-4 border-orange-500' :
                  urgency === 'overdue' ? 'border-l-4 border-red-500' :
                  urgency === 'critical' ? 'border-l-4 border-orange-500' :
                  urgency === 'urgent' ? 'border-l-4 border-yellow-500' :
                  urgency === 'completed' ? 'border-l-4 border-green-500' :
                  'border-l-4 border-blue-200'
                }`}>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold" style={{ color: '#1e1e21' }}>{project.project_name}</h3>
                          {project.customer_name && (
                            <span className="text-sm text-gray-500">• {project.customer_name}</span>
                          )}
                          {activeTab === 'queue' ? (
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700">
                              Awaiting Assignment
                            </span>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                              {project.status}
                            </span>
                          )}
                          <span className={`font-semibold ${getPriorityColor(project.priority)}`}>
                            {project.priority}
                          </span>
                          {project.project_type && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              {project.project_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <User size={16} />
                            {project.assigned_to}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={16} />
                            {new Date(project.start_date).toLocaleDateString()} - {new Date(project.deadline).toLocaleDateString()} ({duration} day{duration > 1 ? 's' : ''})
                          </span>
                          {project.status === 'Completed' && project.completed_at ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle size={16} />
                              Completed {new Date(project.completed_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className={`flex items-center gap-1 ${daysLeft < 0 ? 'text-red-600 font-semibold' : ''}`}>
                              <Clock size={16} />
                              {daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleExpanded(project.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>

                    {activeTab !== 'queue' && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Progress: {project.progress_percent}%</span>
                          <span className={isOverBudget ? 'text-red-600 font-semibold' : ''}>
                            {project.hours_used} / {project.hours_allocated} hours
                            {isOverBudget && ' (Over budget!)'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(project.progress_percent, 100)}%`,
                              backgroundColor: project.status === 'Completed' ? '#10b981' : isOverBudget ? '#ef4444' : '#2b388f'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="border-t pt-4 mt-4">
                        {/* Attachments Section */}
                        {project.attachments && project.attachments.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 mb-2">Attachments</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {project.attachments.map((file, idx) => (
                                <a
                                  key={idx}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <FileText size={20} className="text-gray-600" />
                                  <span className="text-sm font-medium truncate">{file.name}</span>
                                  <Download size={16} className="text-gray-400 ml-auto" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {view === 'manager' ? (
                          <>
                            {activeTab === 'queue' ? (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Assign to Fabricator
                                </label>
                                <div className="flex gap-2">
                                  <select
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        assignProject(project.id, e.target.value)
                                      }
                                    }}
                                  >
                                    <option value="">Select fabricator...</option>
                                    {fabricators.map(fab => (
                                      <option key={fab.id} value={fab.name}>{fab.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : project.status !== 'Completed' && (
                              <>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Reassign to
                                    </label>
                                    <select
                                      value={project.assigned_to}
                                      onChange={(e) => updateProject(project.id, { assigned_to: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    >
                                      {fabricators.map(fab => (
                                        <option key={fab.id} value={fab.name}>{fab.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Hours Used
                                    </label>
                                    <input
                                      type="number"
                                      value={project.hours_used}
                                      onChange={(e) => updateProject(project.id, { hours_used: parseInt(e.target.value) || 0 })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Progress %
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={project.progress_percent}
                                      onChange={(e) => updateProject(project.id, { progress_percent: parseInt(e.target.value) || 0 })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Status
                                    </label>
                                    <select
                                      value={project.status}
                                      onChange={(e) => updateProject(project.id, { status: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    >
                                      <option value="Not Started">Not Started</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="Completed">Completed</option>
                                    </select>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Notes
                                    </label>
                                    <textarea
                                      value={project.notes || ''}
                                      onChange={(e) => updateProject(project.id, { notes: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                      rows="2"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="mb-4">
                            {project.notes && (
                              <div className="mb-3 p-3 bg-yellow-50 rounded-lg">
                                <p className="text-sm text-gray-700"><strong>Notes:</strong> {project.notes}</p>
                              </div>
                            )}
                            {project.status !== 'Completed' && activeTab !== 'queue' && (
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <AlertCircle size={16} />
                                <span>Hours remaining: {hoursRemaining}h</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-3">
                          {project.status !== 'Completed' && activeTab !== 'queue' && (
                            <button
                              onClick={() => markComplete(project.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                            >
                              <Check size={18} />
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {displayProjects.length === 0 && activeTab !== 'calendar' && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">
              {activeTab === 'queue' ? 'No unassigned projects' :
               activeTab === 'active' ? 'No active projects found' : 
               'No completed projects yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}