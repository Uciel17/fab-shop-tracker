'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, User, Clock, AlertCircle, ChevronDown, ChevronUp, Check, LogOut } from 'lucide-react'

export default function FabShopTracker() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [view, setView] = useState('manager')
  const [selectedFabricator, setSelectedFabricator] = useState('all')
  const [showAddProject, setShowAddProject] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState(new Set())
  const router = useRouter()

  const fabricators = ['John Martinez', 'Sarah Chen', 'Mike Johnson', 'Dave Williams']

  const [newProject, setNewProject] = useState({
    project_name: '',
    assigned_to: '',
    hours_allocated: '',
    deadline: '',
    priority: 'Medium',
    notes: ''
  })

  useEffect(() => {
    checkUser()
    fetchProjects()
    
    const subscription = supabase
      .channel('projects_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, 
        (payload) => {
          fetchProjects()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
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

  const addProject = async () => {
    if (newProject.project_name && newProject.assigned_to && newProject.hours_allocated && newProject.deadline) {
      const { error } = await supabase
        .from('projects')
        .insert([{
          ...newProject,
          status: 'Not Started',
          hours_used: 0,
          progress_percent: 0,
          hours_allocated: parseInt(newProject.hours_allocated),
          milestones: []
        }])
      
      if (error) {
        console.error('Error adding project:', error)
      } else {
        setNewProject({
          project_name: '',
          assigned_to: '',
          hours_allocated: '',
          deadline: '',
          priority: 'Medium',
          notes: ''
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

  const markComplete = async (id) => {
    const project = projects.find(p => p.id === id)
    await updateProject(id, { 
      status: 'Completed', 
      progress_percent: 100,
      hours_used: project.hours_allocated 
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
      case 'Delayed': return 'bg-red-100 text-red-700'
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  const filteredProjects = selectedFabricator === 'all' 
    ? projects 
    : projects.filter(p => p.assigned_to === selectedFabricator)

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1
    if (a.status !== 'Completed' && b.status === 'Completed') return -1
    const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return new Date(a.deadline) - new Date(b.deadline)
  })

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Fabrication Shop Tracker</h1>
            <div className="flex gap-3 items-center">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <select 
                value={view} 
                onChange={(e) => setView(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="manager">Manager View</option>
                <option value="fabricator">Fabricator View</option>
              </select>
              {view === 'manager' && (
                <button
                  onClick={() => setShowAddProject(!showAddProject)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={20} />
                  Add Project
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <User size={20} className="text-gray-500" />
            <select
              value={selectedFabricator}
              onChange={(e) => setSelectedFabricator(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Fabricators</option>
              {fabricators.map(fab => (
                <option key={fab} value={fab}>{fab}</option>
              ))}
            </select>
          </div>
        </div>

        {showAddProject && view === 'manager' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">New Project</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Project Name"
                value={newProject.project_name}
                onChange={(e) => setNewProject({...newProject, project_name: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={newProject.assigned_to}
                onChange={(e) => setNewProject({...newProject, assigned_to: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Assign to...</option>
                {fabricators.map(fab => (
                  <option key={fab} value={fab}>{fab}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Hours Allocated"
                value={newProject.hours_allocated}
                onChange={(e) => setNewProject({...newProject, hours_allocated: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={newProject.deadline}
                onChange={(e) => setNewProject({...newProject, deadline: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={newProject.priority}
                onChange={(e) => setNewProject({...newProject, priority: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={addProject}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Project
              </button>
              <button
                onClick={() => setShowAddProject(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {sortedProjects.map(project => {
            const daysLeft = getDaysUntilDeadline(project.deadline)
            const isExpanded = expandedProjects.has(project.id)
            const hoursRemaining = project.hours_allocated - project.hours_used
            const isOverBudget = project.hours_used > project.hours_allocated
            
            return (
              <div key={project.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{project.project_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                        <span className={`font-semibold ${getPriorityColor(project.priority)}`}>
                          {project.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <User size={16} />
                          {project.assigned_to}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={16} />
                          {daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`}
                        </span>
                        <span>Due: {new Date(project.deadline).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleExpanded(project.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

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
                        className={`h-3 rounded-full transition-all ${
                          project.status === 'Completed' ? 'bg-green-500' :
                          isOverBudget ? 'bg-red-500' :
                          project.progress_percent > 75 ? 'bg-blue-500' :
                          'bg-blue-400'
                        }`}
                        style={{ width: `${Math.min(project.progress_percent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t pt-4 mt-4">
                      {view === 'manager' ? (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Hours Used
                            </label>
                            <input
                              type="number"
                              value={project.hours_used}
                              onChange={(e) => updateProject(project.id, { hours_used: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Notes
                            </label>
                            <textarea
                              value={project.notes || ''}
                              onChange={(e) => updateProject(project.id, { notes: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows="2"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4">
                          {project.notes && (
                            <div className="mb-3 p-3 bg-yellow-50 rounded-lg">
                              <p className="text-sm text-gray-700"><strong>Notes:</strong> {project.notes}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <AlertCircle size={16} />
                            <span>Hours remaining: {hoursRemaining}h</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {project.status !== 'Completed' && (
                          <button
                            onClick={() => markComplete(project.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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

        {sortedProjects.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">No projects found for this filter</p>
          </div>
        )}
      </div>
    </div>
  )
}