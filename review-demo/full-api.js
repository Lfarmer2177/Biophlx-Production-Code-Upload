const now=new Date().toISOString();
export const exercises=[
 {exercise_id:'Air Squats',name:'Air Squats',category:'Legs',target_rom_leg:100,muscle_group:['Quads:70','Glutes:30'],equipment_required:'None',instructions:'Stand with feet shoulder-width apart. Bend your knees and hips under control. Return to standing.'},
 {exercise_id:'Barbell Bench Press',name:'Barbell Bench Press',category:'Chest',target_rom_arm:100,muscle_group:['Chest:70','Triceps:30'],equipment_required:'Barbell',instructions:'Lie on the bench. Lower the bar under control. Press upward.'},
 {exercise_id:'Dumbbell Squat and Overhead Press',name:'Dumbbell Squat and Overhead Press',category:'Full Body',target_rom_leg:100,target_rom_arm:90,muscle_group:['Quads:50','Deltoids:50'],equipment_required:'Dumbbells',instructions:'Hold weights at shoulder height. Squat with control. Stand and press overhead.'},
];
const initial={user:{user_id:'demo-user',first_name:'Jordan',last_name:'Demo',email:'demo@example.test',gender:'male',role:'customer',current_weight:75,height:175,age:30},workouts:[{workout_id:'saved-1',customer_id:'demo-user',name:'Saved Strength Session',created_at:now}],items:[],sessions:[],sessionItems:[],reps:[],sets:[],permissions:[],signedIn:false};
initial.items=exercises.slice(0,2).map((ex,i)=>({workout_id:'saved-1',workout_item_index:i+1,exercise_id:ex.exercise_id,muscle_focus:ex.category,target_sets:2,target_reps:8,target_weight:10}));
export let db=JSON.parse(localStorage.getItem('biophlx-demo-v2')||'null')||initial;
export function save(){localStorage.setItem('biophlx-demo-v2',JSON.stringify(db));}
export function reset(){localStorage.removeItem('biophlx-demo-v2');location.reload();}
const trainer={trainer_id:'trainer-1',user_id:'coach-1',training_focus:'Strength and conditioning',workouts_created:1};
const product={workout_product_id:'product-1',trainer_id:'trainer-1',name:'Foundation Strength',price:19,difficulty_level:'Beginner',fitness_goal:'Build strength',workout_id:['coach-workout']};
const coachWorkout={workout_id:'coach-workout',trainer_id:'trainer-1',name:'Coach Strength Basics',created_at:now};
const connection=items=>({items,nextToken:null});
export const generateClient=()=>({graphql:async({query,variables:v={}})=>{
 const field=(String(query).match(/\{\s*(\w+)\s*[({]/)||[])[1];let result;
 const arr=(name)=>db[name].filter(x=>!v.session_id||x.session_id===v.session_id);
 switch(field){
 case 'listExercises':result=connection(exercises);break;
 case 'getExercise':result=exercises.find(e=>e.exercise_id===v.exercise_id);break;
 case 'getUser':result=v.user_id==='coach-1'?{user_id:'coach-1',first_name:'Alex',last_name:'Morgan',city:'Austin',state:'TX',bio:'Sample trainer profile for the local demo.'}:db.user;break;
 case 'listCustomers':result=connection([{customer_id:'demo-user',user_id:'demo-user'}]);break;
 case 'getCustomer':result={customer_id:'demo-user',user_id:'demo-user'};break;
 case 'listTrainers':result=connection(v.user_id==='demo-user'?[]:[trainer]);break;
 case 'getTrainer':result=trainer;break;
 case 'listWorkoutsByCustomer':result=db.workouts;break;
 case 'listWorkoutsByTrainer':result=[coachWorkout];break;
 case 'getWorkout':result=v.workout_id==='coach-workout'?coachWorkout:db.workouts.find(x=>x.workout_id===v.workout_id);break;
 case 'listWorkoutItems':case 'listWorkoutItemsByWorkout':result=v.workout_id==='coach-workout'?initial.items.map(x=>({...x,workout_id:'coach-workout'})):db.items.filter(x=>x.workout_id===v.workout_id);break;
 case 'listWorkoutProductsByTrainer':result=[product];break;
 case 'getWorkoutProduct':result=product;break;
 case 'listVirtualTrainingServicesByTrainer':result=connection([]);break;
 case 'listPermissionsByUser':result=connection(db.permissions);break;
 case 'listSessionsByCustomer':result=db.sessions;break;
 case 'listSessionItemsBySession':result=arr('sessionItems');break;
 case 'listSessionItemReps':result=connection(arr('reps'));break;
 case 'listSessionItemSets':result=arr('sets').filter(x=>v.session_item_index==null||x.session_item_index===v.session_item_index);break;
 case 'createStripeCheckout':result={url:'demo-checkout://product-1'};break;
 default:
  if(field?.startsWith('create')||field?.startsWith('update')){
   result={...v.input,created_at:now};
   const table={createWorkout:'workouts',createWorkoutItem:'items',createSession:'sessions',createSessionItem:'sessionItems',createSessionItemRep:'reps',createSessionItemSet:'sets'}[field];
   if(table)db[table].push(result);
   if(field==='updateUser')db.user={...db.user,...v.input};
   save();
  } else throw new Error('Demo adapter has no fixture for '+field);
 }
 return {data:{[field]:result}};
}});
export const getCurrentUser=async()=>({userId:'demo-user',username:db.user.email});
export const fetchUserAttributes=async()=>({email:db.user.email});
export const fetchAuthSession=async()=>db.signedIn?{tokens:{demo:true}}:{};
export const signIn=async({username,password})=>{if(!username?.includes('@')||!password)throw new Error('Enter a demo email and password.');db.signedIn=true;save();return {isSignedIn:true};};
export const signOut=async()=>{db.signedIn=false;save();};
export const signUp=async({username,password})=>{if(!username?.includes('@')||password.length<8)throw new Error('Use an email and a password of at least 8 characters.');db.user={...db.user,email:username,first_name:'',last_name:''};save();return {nextStep:{signUpStep:'CONFIRM_SIGN_UP'}};};
export const confirmSignUp=async({confirmationCode})=>{if(confirmationCode!=='123456')throw new Error('Use demo verification code 123456.');};
export const resetPassword=async()=>({nextStep:{resetPasswordStep:'CONFIRM_RESET_PASSWORD_WITH_CODE'}});
export const confirmResetPassword=async({confirmationCode})=>{if(confirmationCode!=='123456')throw new Error('Use demo code 123456.');};
export const uploadData=()=>({result:Promise.reject(new Error('File uploads are disabled in the demo.'))});
export function completePurchase(){if(!db.permissions.length)db.permissions.push({user_id:'demo-user',resource_id:'product-1',trainer_id:'trainer-1',product_type:'workout_product',status:'active',purchased_at:now});save();}
